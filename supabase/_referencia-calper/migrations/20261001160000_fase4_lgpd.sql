-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 4: LGPD (retenção, anonimização, opt-out)
--
--   1. wa_opt_outs: lista de descadastro (CPF, e-mail ou telefone). Campanhas novas NÃO enviam para
--      quem está nela (o destinatário entra como 'opt_out'). Só o servidor lê e grava.
--   2. wa_campanha_destinatarios.anonimizado_em + funções de anonimização (service_role):
--        · wa_anonimizar_campanha(id)   — anonimiza todos os destinatários da campanha;
--        · wa_anonimizar_titular(...)   — direito de eliminação: anonimiza a pessoa em TODAS as campanhas
--                                         (por CPF, e-mail ou telefone, inclusive o do cônjuge);
--        · wa_titular_ocorrencias(...)  — direito de acesso: onde a pessoa aparece (sem dados pessoais).
--      Anonimizar mantém o que serve a estatística (empreendimento, status, datas) e apaga o que
--      identifica (nome, CPF, telefone, e-mail, bloco, unidade, dados_extras, mensagens de erro e o
--      JSON bruto do DocuSign em docusign_envelopes.raw).
--   3. Retenção automática (wa_retencao_executar, já agendada no pg_cron): destinatários de campanhas
--      encerradas há mais de N meses (padrão 12, ajustável em wa_retencao_config) são anonimizados;
--      campanhas que nunca encerraram, após 18 meses; docusign_envelopes.raw é apagado após N meses.
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lista de descadastro (opt-out)
-- ---------------------------------------------------------------------
create table if not exists public.wa_opt_outs (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('cpf', 'email', 'telefone')),
  valor       text not null,                                   -- normalizado: só dígitos / e-mail minúsculo
  motivo      text,
  origem      text not null default 'manual',                  -- manual | titular | importacao
  criado_por  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tipo, valor)
);
alter table public.wa_opt_outs enable row level security;
revoke all on public.wa_opt_outs from public, anon, authenticated;
grant all on public.wa_opt_outs to service_role;

-- ---------------------------------------------------------------------
-- 2. Parâmetros de retenção (uma linha só; ajuste aqui, sem redeploy)
-- ---------------------------------------------------------------------
create table if not exists public.wa_retencao_config (
  id                       boolean primary key default true check (id),
  destinatarios_meses      integer not null default 12 check (destinatarios_meses between 1 and 120),
  campanhas_abertas_meses  integer not null default 18 check (campanhas_abertas_meses between 1 and 120)
);
insert into public.wa_retencao_config (id) values (true) on conflict (id) do nothing;
alter table public.wa_retencao_config enable row level security;
revoke all on public.wa_retencao_config from public, anon, authenticated;
grant all on public.wa_retencao_config to service_role;

-- ---------------------------------------------------------------------
-- 3. Anonimização
-- ---------------------------------------------------------------------
alter table public.wa_campanha_destinatarios add column if not exists anonimizado_em timestamptz;
create index if not exists idx_wa_destinatarios_anonimizado on public.wa_campanha_destinatarios (anonimizado_em)
  where anonimizado_em is null;

-- Telefone normalizado: só dígitos, sem o 55 do país quando o número tem 12 ou 13 dígitos (mesma regra
-- de src/lib/optout.ts), para casar "5521999990000" com "21999990000".
create or replace function public.wa_norm_tel(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(d) in (12, 13) and d like '55%' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

-- Núcleo: anonimiza as linhas informadas e limpa o JSON bruto do DocuSign delas.
create or replace function public.wa_anonimizar_linhas(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  update public.docusign_envelopes e
     set raw = null
   where e.raw is not null
     and (e.destinatario_id = any (p_ids)
          or e.envelope_id in (select d.envelope_docusign_id
                                 from public.wa_campanha_destinatarios d
                                where d.id = any (p_ids) and d.envelope_docusign_id is not null));

  update public.wa_campanha_destinatarios d
     set nome = 'Anonimizado',
         cpf = null,
         telefone = null,
         email = null,
         bloco = null,
         unidade = null,
         dados_extras = '{}'::jsonb,
         erro_msg = null,
         anonimizado_em = now()
   where d.id = any (p_ids)
     and d.anonimizado_em is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

create or replace function public.wa_anonimizar_campanha(p_campanha_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.wa_anonimizar_linhas(coalesce(
    (select array_agg(d.id) from public.wa_campanha_destinatarios d
      where d.campanha_id = p_campanha_id and d.anonimizado_em is null),
    '{}'::uuid[]));
$$;

-- Direito de eliminação do titular: por CPF, e-mail e/ou telefone (já normalizados pelo servidor).
-- Linha em que a pessoa é o comprador principal → anonimiza a linha toda. Linha em que ela só consta
-- como cônjuge (dados_extras) → remove apenas os dados do cônjuge.
create or replace function public.wa_anonimizar_titular(p_cpf text default null, p_email text default null, p_telefone text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(public.wa_norm_tel(p_telefone), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_principais uuid[];
  v_conjuges uuid[];
  v_n integer := 0;
  v_c integer := 0;
begin
  if v_cpf is null and v_tel is null and v_email is null then
    raise exception 'Informe CPF, e-mail ou telefone do titular.';
  end if;

  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_principais
    from public.wa_campanha_destinatarios d
   where d.anonimizado_em is null
     and ((v_cpf is not null and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf)
       or (v_email is not null and lower(coalesce(d.email, '')) = v_email)
       or (v_tel is not null and public.wa_norm_tel(d.telefone) = v_tel));

  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_conjuges
    from public.wa_campanha_destinatarios d
   where d.anonimizado_em is null
     and d.id <> all (v_principais)
     and ((v_cpf is not null and regexp_replace(coalesce(d.dados_extras->>'cpf_conjuge', ''), '\D', '', 'g') = v_cpf)
       or (v_email is not null and lower(coalesce(d.dados_extras->>'email_conjuge', '')) = v_email)
       or (v_tel is not null and public.wa_norm_tel(d.dados_extras->>'telefone_conjuge') = v_tel));

  v_n := public.wa_anonimizar_linhas(v_principais);

  update public.wa_campanha_destinatarios d
     set dados_extras = d.dados_extras - 'nome_conjuge' - 'email_conjuge' - 'telefone_conjuge' - 'cpf_conjuge'
   where d.id = any (v_conjuges);
  get diagnostics v_c = row_count;

  -- O JSON bruto do DocuSign dessas linhas pode trazer o nome/e-mail do cônjuge.
  update public.docusign_envelopes e
     set raw = null
   where e.raw is not null
     and e.envelope_id in (select d.envelope_docusign_id from public.wa_campanha_destinatarios d
                            where d.id = any (v_conjuges) and d.envelope_docusign_id is not null);

  return v_n + v_c;
end
$$;

-- Direito de acesso: onde o titular aparece. Não devolve dados pessoais, só o contexto.
create or replace function public.wa_titular_ocorrencias(p_cpf text default null, p_email text default null, p_telefone text default null)
returns table (
  destinatario_id uuid,
  campanha_id uuid,
  campanha_nome text,
  campanha_criada_em timestamptz,
  status text,
  empreendimento text,
  enviado_em timestamptz,
  papel text,
  anonimizado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(public.wa_norm_tel(p_telefone), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
begin
  if v_cpf is null and v_tel is null and v_email is null then
    raise exception 'Informe CPF, e-mail ou telefone do titular.';
  end if;

  return query
  select d.id, c.id, c.nome, c.created_at, d.status::text, d.empreendimento, d.enviado_em,
         case
           when (v_cpf is not null and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf)
             or (v_email is not null and lower(coalesce(d.email, '')) = v_email)
             or (v_tel is not null and public.wa_norm_tel(d.telefone) = v_tel)
           then 'comprador' else 'conjuge' end,
         d.anonimizado_em
    from public.wa_campanha_destinatarios d
    join public.wa_campanhas c on c.id = d.campanha_id
   where d.anonimizado_em is null
     and ((v_cpf is not null and (regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf
                               or regexp_replace(coalesce(d.dados_extras->>'cpf_conjuge', ''), '\D', '', 'g') = v_cpf))
       or (v_email is not null and (lower(coalesce(d.email, '')) = v_email
                                 or lower(coalesce(d.dados_extras->>'email_conjuge', '')) = v_email))
       or (v_tel is not null and (public.wa_norm_tel(d.telefone) = v_tel
                               or public.wa_norm_tel(d.dados_extras->>'telefone_conjuge') = v_tel)))
   order by c.created_at desc
   limit 200;
end
$$;

revoke all on function public.wa_anonimizar_linhas(uuid[]) from public, anon, authenticated;
revoke all on function public.wa_anonimizar_campanha(uuid) from public, anon, authenticated;
revoke all on function public.wa_anonimizar_titular(text, text, text) from public, anon, authenticated;
revoke all on function public.wa_titular_ocorrencias(text, text, text) from public, anon, authenticated;
grant execute on function public.wa_anonimizar_linhas(uuid[]) to service_role;
grant execute on function public.wa_anonimizar_campanha(uuid) to service_role;
grant execute on function public.wa_anonimizar_titular(text, text, text) to service_role;
grant execute on function public.wa_titular_ocorrencias(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. Retenção automática (substitui a função da migração 20261001130000)
-- ---------------------------------------------------------------------
create or replace function public.wa_retencao_executar()
returns table (tabela text, apagados bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
  cfg record;
  v_ids uuid[];
begin
  select coalesce(c.destinatarios_meses, 12) as destinatarios_meses,
         coalesce(c.campanhas_abertas_meses, 18) as campanhas_abertas_meses
    into cfg
    from (select 1) x
    left join public.wa_retencao_config c on c.id;

  if to_regclass('public.gateway_call_log') is not null then
    delete from public.gateway_call_log where created_at < now() - interval '30 days';
    get diagnostics n = row_count;
    tabela := 'gateway_call_log'; apagados := n; return next;
  end if;

  delete from public.auth_login_log where created_at < now() - interval '180 days';
  get diagnostics n = row_count;
  tabela := 'auth_login_log'; apagados := n; return next;

  delete from public.auth_tentativas
   where coalesce(bloqueado_ate, ultima_falha_em, now()) < now() - interval '1 day';
  get diagnostics n = row_count;
  tabela := 'auth_tentativas'; apagados := n; return next;

  delete from public.auth_falhas_por_usuario
   where coalesce(bloqueado_ate, ultima_falha_em, now()) < now() - interval '1 day';
  get diagnostics n = row_count;
  tabela := 'auth_falhas_por_usuario'; apagados := n; return next;

  delete from public.wa_auditoria where created_at < now() - interval '2 years';
  get diagnostics n = row_count;
  tabela := 'wa_auditoria'; apagados := n; return next;

  -- Dados de compradores: anonimiza (não apaga) destinatários de campanhas encerradas há mais de N
  -- meses e de campanhas que nunca encerraram há mais de M meses. As estatísticas continuam valendo.
  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_ids
    from public.wa_campanha_destinatarios d
    join public.wa_campanhas c on c.id = d.campanha_id
   where d.anonimizado_em is null
     and ((c.status in ('concluida', 'erro', 'cancelada')
           and c.updated_at < now() - make_interval(months => cfg.destinatarios_meses))
       or c.created_at < now() - make_interval(months => cfg.campanhas_abertas_meses));
  n := public.wa_anonimizar_linhas(v_ids);
  tabela := 'wa_campanha_destinatarios (anonimizados)'; apagados := n; return next;

  -- JSON bruto do DocuSign (nomes, e-mails, telefones dos signatários) sem utilidade após o prazo.
  update public.docusign_envelopes
     set raw = null
   where raw is not null
     and created_at < now() - make_interval(months => cfg.destinatarios_meses);
  get diagnostics n = row_count;
  tabela := 'docusign_envelopes (raw limpo)'; apagados := n; return next;
end
$$;

revoke all on function public.wa_retencao_executar() from public, anon, authenticated;
grant execute on function public.wa_retencao_executar() to service_role;
