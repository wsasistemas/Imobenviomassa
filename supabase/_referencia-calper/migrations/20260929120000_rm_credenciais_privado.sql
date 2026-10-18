-- =====================================================================
-- Disparo em Massa — credenciais do TOTVS RM no mesmo modelo do Portal DP
--
--   · o usuário e a senha do RM ficam num schema PRIVADO (envio_privado), que NÃO é exposto na Data API
--     e não tem policies: nenhuma chave anon/authenticated lê essas tabelas;
--   · usuário e senha são comuns; cada integração (empreendimentos, compradores) tem o seu endpoint
--     (URL completa);
--   · só o servidor do app (Vercel, chave service_role) executa as funções abaixo. A senha nunca volta
--     para a tela nem aparece em log.
--
-- Substitui public.totvs_config (senha em texto legível para a Data API). Os dados atuais são copiados
-- daqui mesmo. A tabela antiga só é removida por supabase/pos-migracao/20260929_remover_totvs_config.sql,
-- depois de validar a integração.
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema privado
-- ---------------------------------------------------------------------
create schema if not exists envio_privado;
revoke all on schema envio_privado from public, anon, authenticated;
grant usage on schema envio_privado to service_role;

-- usuário e senha do RM (uma linha só)
create table if not exists envio_privado.integracao_rm (
  id             int primary key default 1 check (id = 1),
  usuario        text not null default '',
  senha          text not null default '',
  atualizado_em  timestamptz not null default now(),
  atualizado_por text not null default ''
);

-- um endpoint por integração
create table if not exists envio_privado.integracao_rm_recurso (
  recurso        text primary key check (recurso in ('empreendimentos', 'compradores')),
  endpoint       text not null default '',
  ultima_consulta timestamptz,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text not null default ''
);

alter table envio_privado.integracao_rm enable row level security;          -- sem policies
alter table envio_privado.integracao_rm_recurso enable row level security;  -- sem policies
revoke all on all tables in schema envio_privado from public, anon, authenticated;
grant select, insert, update on envio_privado.integracao_rm to service_role;
grant select, insert, update on envio_privado.integracao_rm_recurso to service_role;

insert into envio_privado.integracao_rm (id) values (1) on conflict (id) do nothing;
insert into envio_privado.integracao_rm_recurso (recurso) values ('empreendimentos'), ('compradores')
on conflict (recurso) do nothing;

-- ---------------------------------------------------------------------
-- 2. Copia o que estava em public.totvs_config (base_url + caminho → endpoint completo)
-- ---------------------------------------------------------------------
do $$
declare
  v record;
  v_origem text;
begin
  if to_regclass('public.totvs_config') is null then
    return;
  end if;

  select base_url, username, password, empreendimentos_path, compradores_path
    into v
    from public.totvs_config
   order by updated_at desc nulls last
   limit 1;
  if not found then
    return;
  end if;

  v_origem := coalesce(substring(btrim(coalesce(v.base_url, '')) from '^(https?://[^/]+)'), '');

  -- só preenche o que ainda está vazio: rodar de novo não sobrescreve o que foi alterado na tela
  update envio_privado.integracao_rm
     set usuario = btrim(coalesce(v.username, '')),
         senha   = coalesce(v.password, ''),
         atualizado_por = 'migração totvs_config'
   where id = 1 and usuario = '' and senha = '';

  update envio_privado.integracao_rm_recurso r
     set endpoint = case
                      when x.caminho ~* '^https?://' then x.caminho
                      when x.caminho = '' then ''
                      else v_origem || case when left(x.caminho, 1) = '/' then '' else '/' end || x.caminho
                    end,
         atualizado_por = 'migração totvs_config'
    from (values ('empreendimentos', btrim(coalesce(v.empreendimentos_path, ''))),
                 ('compradores',     btrim(coalesce(v.compradores_path, '')))) as x(recurso, caminho)
   where r.recurso = x.recurso and r.endpoint = '';
end
$$;

-- ---------------------------------------------------------------------
-- 3. Funções da integração (todas security definer; só a service_role executa)
-- ---------------------------------------------------------------------

-- Credenciais de uma integração, com a senha. Usada pelo servidor do app e pelas Edge Functions.
create or replace function public.rm_credenciais(p_recurso text default 'empreendimentos')
returns table (endpoint text, usuario text, senha text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.endpoint, i.usuario, i.senha
  from envio_privado.integracao_rm i
  join envio_privado.integracao_rm_recurso r on r.recurso = coalesce(p_recurso, 'empreendimentos')
  where i.id = 1
$$;

-- Grava usuário/senha (comuns) e o endpoint da integração informada. Usuário ou senha em branco
-- mantêm os atuais.
create or replace function public.rm_credenciais_salvar(
  p_endpoint text,
  p_usuario  text,
  p_senha    text,
  p_autor    text,
  p_recurso  text default 'empreendimentos'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recurso text := coalesce(nullif(btrim(p_recurso), ''), 'empreendimentos');
begin
  if v_recurso not in ('empreendimentos', 'compradores') then
    raise exception 'Integração desconhecida: %', v_recurso using errcode = '22023';
  end if;

  insert into envio_privado.integracao_rm (id, usuario, senha, atualizado_em, atualizado_por)
  values (1, btrim(coalesce(p_usuario, '')), coalesce(p_senha, ''), now(), coalesce(p_autor, ''))
  on conflict (id) do update
    set usuario        = case when excluded.usuario = '' then envio_privado.integracao_rm.usuario else excluded.usuario end,
        senha          = case when excluded.senha = '' then envio_privado.integracao_rm.senha else excluded.senha end,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;

  insert into envio_privado.integracao_rm_recurso (recurso, endpoint, atualizado_em, atualizado_por)
  values (v_recurso, btrim(coalesce(p_endpoint, '')), now(), coalesce(p_autor, ''))
  on conflict (recurso) do update
    set endpoint       = excluded.endpoint,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;
end
$$;

-- Marca a última consulta bem-sucedida de uma integração.
create or replace function public.rm_consulta_registrar(p_recurso text default 'empreendimentos')
returns void
language sql
security definer
set search_path = ''
as $$
  update envio_privado.integracao_rm_recurso
     set ultima_consulta = now()
   where recurso = coalesce(p_recurso, 'empreendimentos')
$$;

-- Situação das integrações, SEM a senha (tela de Configurações → Integrações TOTVS RM).
create or replace function public.rm_status()
returns table (
  recurso         text,
  configurado     boolean,
  endpoint        text,
  usuario         text,
  atualizado_em   timestamptz,
  atualizado_por  text,
  ultima_consulta timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.recurso,
         (r.endpoint <> '' and i.usuario <> '' and i.senha <> ''),
         r.endpoint,
         i.usuario,
         greatest(r.atualizado_em, i.atualizado_em),
         case when r.atualizado_em >= i.atualizado_em then r.atualizado_por else i.atualizado_por end,
         r.ultima_consulta
  from envio_privado.integracao_rm_recurso r
  cross join envio_privado.integracao_rm i
  where i.id = 1
  order by r.recurso desc
$$;

revoke all on function public.rm_credenciais(text) from public, anon, authenticated;
revoke all on function public.rm_credenciais_salvar(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rm_consulta_registrar(text) from public, anon, authenticated;
revoke all on function public.rm_status() from public, anon, authenticated;
grant execute on function public.rm_credenciais(text) to service_role;
grant execute on function public.rm_credenciais_salvar(text, text, text, text, text) to service_role;
grant execute on function public.rm_consulta_registrar(text) to service_role;
grant execute on function public.rm_status() to service_role;
