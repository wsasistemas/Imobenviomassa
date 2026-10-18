-- =====================================================================================================
-- Imobenviomassa (Disparo em Massa — WSA Sistemas) — 02: estrutura completa no Supabase ImobSystem
-- Projeto: ikvjaowvpvxojvcfwnct · schema: imobenviomassa · app: https://enviomassa.imobsystems.com.br
--
-- Decisões do Wagner (17/10/2026):
--   · independente do Supabase da Calper: tudo é recriado aqui, com os mesmos processos do app;
--   · várias imobiliárias (SaaS), como o Imobsuprimentos: toda tabela tem imobiliaria_id + RLS por
--     imobenviomassa.tenant_atual(); só a WSA (service_role) cria imobiliárias;
--   · perfis e permissões no modelo do Portal_Atendimento: perfis criados pela tela + matriz
--     perfil_permissoes (ids do src/config/menu-registry.ts);
--   · contrato da Central de acessos do ikvj: imobenviomassa.usuarios(id, email, nome, perfil, ativo) e
--     imobenviomassa.perfis(chave, nome, ordem).
--
-- Nomes de tabelas e RPCs iguais aos do app (wa_campanhas, auth_pre_login, rm_credenciais …): o front só
-- troca o schema do cliente. As funções que antes eram globais recebem a imobiliária (p_imobiliaria).
--
-- Pré-requisitos: 01 (schema) aplicada e a Central de acessos (acessos.aplicativos, acessos.eu_posso).
-- Roda uma vez só, num banco sem as tabelas do app. Tudo numa transação no SQL Editor.
-- NÃO instala o Auth Hook de senha: o login do ikvj é compartilhado com ImobSystem, Imobsuprimentos e
-- ImobDoces, e um hook vale para todos. O limite de tentativas fica na server function (auth_pre_login).
-- =====================================================================================================

-- ---------------------------------------------------------------------------------------------------
-- 0. Pré-requisitos
-- ---------------------------------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('imobenviomassa') is null then
    raise exception 'Rode antes a 01 (20261017233000_imobenviomassa_schema.sql): o schema imobenviomassa não existe.';
  end if;
  if to_regclass('acessos.aplicativos') is null or to_regprocedure('acessos.eu_posso(text)') is null then
    raise exception 'Pré-requisito: Central de Acessos (acessos.aplicativos / acessos.eu_posso) não existe neste projeto.';
  end if;
  if to_regclass('imobenviomassa.usuarios') is not null then
    raise exception 'A estrutura do imobenviomassa já existe. Esta migração só cria do zero.';
  end if;
end $$;

-- Vault (segredos do DocuSign e senha do RM). Sem ele, os segredos ficam na coluna (modelo anterior).
do $$
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    begin
      create extension if not exists supabase_vault with schema vault;
    exception when others then
      raise notice 'Vault não habilitado automaticamente (SQLSTATE %). Habilite em Database > Extensions > supabase_vault.', sqlstate;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 1. Utilitários
-- ---------------------------------------------------------------------------------------------------
create function imobenviomassa.tocar_updated_at() returns trigger
  language plpgsql set search_path to ''
as $$ begin new.updated_at := now(); return new; end $$;

create function imobenviomassa.tocar_atualizado_em() returns trigger
  language plpgsql set search_path to ''
as $$ begin new.atualizado_em := now(); return new; end $$;

create function imobenviomassa.erro(p_codigo text, p_mensagem text) returns void
  language plpgsql set search_path to ''
as $$ begin raise exception '%', p_mensagem using errcode = 'P0001', detail = p_codigo; end $$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Imobiliárias (tenant), perfis e usuários (contrato da Central)
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.imobiliarias (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (length(btrim(nome)) between 2 and 120),
  cnpj              text unique,
  ativo             boolean not null default true,
  tenant_externo_id uuid,                      -- vínculo futuro com public.tenants (ImobSystem), sem FK
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create trigger imobiliarias_tocar before update on imobenviomassa.imobiliarias
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Perfis: os 3 do sistema valem para todas as imobiliárias (imobiliaria_id nulo); os criados pela tela
-- Perfis e permissões pertencem a uma imobiliária. `ordem` maior = perfil mais simples (regra da Central).
create table imobenviomassa.perfis (
  chave          text primary key check (chave ~ '^[a-z0-9_]{2,60}$'),
  nome           text not null check (length(btrim(nome)) between 2 and 40),
  descricao      text check (descricao is null or length(descricao) <= 160),
  ordem          integer not null default 50,
  sistema        boolean not null default false,
  imobiliaria_id uuid references imobenviomassa.imobiliarias(id) on delete cascade,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (sistema = (imobiliaria_id is null))
);
create unique index perfis_nome_por_imobiliaria
  on imobenviomassa.perfis (coalesce(imobiliaria_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));
create trigger perfis_tocar before update on imobenviomassa.perfis
  for each row execute function imobenviomassa.tocar_atualizado_em();

insert into imobenviomassa.perfis (chave, nome, descricao, ordem, sistema) values
  ('super_admin', 'Super Admin', 'Acesso total à imobiliária: usuários, perfis, credenciais e todos os menus.', 0, true),
  ('admin',       'Admin',       'Disparos, integrações (consulta e teste), Gateway, Auditoria e Privacidade.', 1, true),
  ('analista',    'Analista',    'Dashboard, novo disparo, histórico e relatórios.', 100, true);

create table imobenviomassa.usuarios (
  id             uuid primary key references auth.users(id) on delete cascade,
  imobiliaria_id uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  email          text not null,
  nome           text,
  perfil         text not null default 'analista' references imobenviomassa.perfis(chave) on update cascade,
  ativo          boolean not null default true,
  trocar_senha   boolean not null default false,
  adicionado_por uuid references auth.users(id) on delete set null,
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index usuarios_imobiliaria_idx on imobenviomassa.usuarios (imobiliaria_id);
create index usuarios_perfil_idx on imobenviomassa.usuarios (perfil);

-- Preenche e valida: e-mail minúsculo; imobiliária obrigatória (se vier nula — ex.: "Liberar" na Central,
-- que só grava id/email/perfil/ativo — usa a única imobiliária ativa, se houver só uma); perfil precisa ser
-- do sistema ou da mesma imobiliária.
create function imobenviomassa.usuarios_preencher() returns trigger
  language plpgsql security definer set search_path to ''
as $$
declare
  v_unica uuid;
  v_perfil_imob uuid;
  v_perfil_existe boolean;
begin
  new.email := lower(btrim(new.email));
  if new.imobiliaria_id is null then
    select case when count(*) = 1 then (array_agg(i.id))[1] end into v_unica
      from imobenviomassa.imobiliarias i where i.ativo;
    if v_unica is null then
      raise exception 'Informe a imobiliária do usuário.' using errcode = '23502';
    end if;
    new.imobiliaria_id := v_unica;
  end if;
  select true, p.imobiliaria_id into v_perfil_existe, v_perfil_imob
    from imobenviomassa.perfis p where p.chave = new.perfil;
  if v_perfil_existe and v_perfil_imob is not null and v_perfil_imob <> new.imobiliaria_id then
    raise exception 'Perfil % não pertence à imobiliária do usuário.', new.perfil using errcode = '23514';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger usuarios_preencher before insert or update on imobenviomassa.usuarios
  for each row execute function imobenviomassa.usuarios_preencher();

-- Matriz de permissões por imobiliária e perfil (ids do menu-registry). Sem linha = negado.
create table imobenviomassa.perfil_permissoes (
  imobiliaria_id uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  perfil         text not null references imobenviomassa.perfis(chave) on update cascade on delete cascade,
  permission_id  text not null check (permission_id ~ '^[a-z0-9_]{2,60}$'),
  enabled        boolean not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key (imobiliaria_id, perfil, permission_id)
);

-- ---------------------------------------------------------------------------------------------------
-- 3. Quem é o usuário atual (SECURITY DEFINER, nunca recebem o tenant por parâmetro)
-- ---------------------------------------------------------------------------------------------------
-- Imobiliária do usuário logado, se ele estiver ativo, com a imobiliária ativa e liberado na Central.
create function imobenviomassa.tenant_atual() returns uuid
  language sql stable security definer set search_path to ''
as $$
  select u.imobiliaria_id
    from imobenviomassa.usuarios u
    join imobenviomassa.imobiliarias i on i.id = u.imobiliaria_id and i.ativo
   where u.id = (select auth.uid()) and u.ativo and acessos.eu_posso('imobenviomassa')
$$;

create function imobenviomassa.meu_perfil() returns text
  language sql stable security definer set search_path to ''
as $$
  select u.perfil from imobenviomassa.usuarios u
   where u.id = (select auth.uid()) and u.imobiliaria_id = (select imobenviomassa.tenant_atual())
$$;

-- Conta liberada para usar o portal: tenant válido e sem troca de senha pendente (antigo wa_conta_liberada).
create function imobenviomassa.conta_liberada() returns boolean
  language sql stable security definer set search_path to ''
as $$
  select coalesce((select not u.trocar_senha from imobenviomassa.usuarios u
                    where u.id = (select auth.uid()) and u.imobiliaria_id = (select imobenviomassa.tenant_atual())), false)
$$;

-- Admin ou Super Admin da imobiliária (antigo wa_eh_admin).
create function imobenviomassa.sou_admin() returns boolean
  language sql stable security definer set search_path to ''
as $$ select coalesce((select imobenviomassa.meu_perfil()) in ('super_admin', 'admin'), false) $$;

-- Permissão de um usuário: Super Admin tem tudo; os demais, a regra do perfil na imobiliária.
create function imobenviomassa.tem_permissao_de(p_usuario uuid, p_permissao text) returns boolean
  language sql stable security definer set search_path to ''
as $$
  select coalesce((
    select u.perfil = 'super_admin'
        or exists (select 1 from imobenviomassa.perfil_permissoes pp
                    where pp.imobiliaria_id = u.imobiliaria_id and pp.perfil = u.perfil
                      and pp.permission_id = p_permissao and pp.enabled)
      from imobenviomassa.usuarios u
     where u.id = p_usuario and u.ativo), false)
$$;

create function imobenviomassa.tem_permissao(p_permissao text) returns boolean
  language sql stable security definer set search_path to ''
as $$
  select (select imobenviomassa.tenant_atual()) is not null
     and imobenviomassa.tem_permissao_de((select auth.uid()), p_permissao)
$$;

-- Tudo o que o front precisa para montar menu e guarda: perfil, imobiliária e regras do perfil.
create function imobenviomassa.meu_acesso()
  returns table (imobiliaria_id uuid, imobiliaria_nome text, perfil text, perfil_nome text,
                 ativo boolean, trocar_senha boolean, regras jsonb)
  language sql stable security definer set search_path to ''
as $$
  select u.imobiliaria_id, i.nome, u.perfil, p.nome, u.ativo, u.trocar_senha,
         coalesce((select jsonb_object_agg(pp.permission_id, pp.enabled)
                     from imobenviomassa.perfil_permissoes pp
                    where pp.imobiliaria_id = u.imobiliaria_id and pp.perfil = u.perfil), '{}'::jsonb)
    from imobenviomassa.usuarios u
    join imobenviomassa.imobiliarias i on i.id = u.imobiliaria_id
    join imobenviomassa.perfis p on p.chave = u.perfil
   where u.id = (select auth.uid()) and u.imobiliaria_id = (select imobenviomassa.tenant_atual())
$$;

create function imobenviomassa.concluir_troca_senha() returns void
  language sql security definer set search_path to ''
as $$ update imobenviomassa.usuarios set trocar_senha = false where id = (select auth.uid()) $$;

create function imobenviomassa.registrar_acesso() returns void
  language sql security definer set search_path to ''
as $$ update imobenviomassa.usuarios set ultimo_acesso = now() where id = (select auth.uid()) $$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Auditoria (escrita só pelo servidor)
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.wa_auditoria (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid references imobenviomassa.imobiliarias(id) on delete cascade,
  usuario_id     uuid references auth.users(id) on delete set null,
  usuario_nome   text,
  acao           text not null,
  entidade       text,
  entidade_id    text,
  detalhes       jsonb not null default '{}'::jsonb,
  ip             text,
  user_agent     text,
  created_at     timestamptz not null default now()
);
create index wa_auditoria_imob_created_idx on imobenviomassa.wa_auditoria (imobiliaria_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------
-- 5. Perfis e permissões — RPCs da tela (padrão Portal_Atendimento)
-- ---------------------------------------------------------------------------------------------------
-- Pode gerenciar perfis: Super Admin, ou Admin com a permissão "Perfis e permissões".
create function imobenviomassa.eh_gestor_perfis() returns boolean
  language sql stable security definer set search_path to ''
as $$
  select coalesce((select imobenviomassa.meu_perfil()) = 'super_admin'
      or ((select imobenviomassa.meu_perfil()) = 'admin' and imobenviomassa.tem_permissao('manage_permissions')), false)
$$;

create function imobenviomassa.registrar_auditoria(p_acao text, p_entidade text, p_entidade_id text, p_detalhes jsonb)
  returns void language sql security definer set search_path to ''
as $$
  insert into imobenviomassa.wa_auditoria (imobiliaria_id, usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes)
  select (select imobenviomassa.tenant_atual()), u.id, coalesce(u.nome, u.email), p_acao, p_entidade, p_entidade_id,
         coalesce(p_detalhes, '{}'::jsonb)
    from imobenviomassa.usuarios u where u.id = (select auth.uid())
$$;

create function imobenviomassa.listar_perfis()
  returns table (chave text, nome text, descricao text, ordem integer, sistema boolean, travado boolean,
                 total_usuarios bigint, editavel boolean)
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
begin
  if v_tenant is null or not (imobenviomassa.tem_permissao('manage_permissions') or imobenviomassa.tem_permissao('manage_users')) then
    perform imobenviomassa.erro('FORBIDDEN', 'Seu perfil não tem permissão para ver os perfis.');
  end if;
  return query
  select p.chave, p.nome, p.descricao, p.ordem, p.sistema, p.chave = 'super_admin',
         (select count(*) from imobenviomassa.usuarios u where u.perfil = p.chave and u.imobiliaria_id = v_tenant),
         p.chave <> 'super_admin' and imobenviomassa.eh_gestor_perfis()
    from imobenviomassa.perfis p
   where p.imobiliaria_id is null or p.imobiliaria_id = v_tenant
   order by p.ordem, p.nome;
end $$;

create function imobenviomassa.regras_do_perfil(p_perfil text)
  returns table (permission_id text, enabled boolean)
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
begin
  if v_tenant is null or not imobenviomassa.tem_permissao('manage_permissions') then
    perform imobenviomassa.erro('FORBIDDEN', 'Seu perfil não tem permissão para ver as permissões.');
  end if;
  return query
  select pp.permission_id, pp.enabled from imobenviomassa.perfil_permissoes pp
   where pp.imobiliaria_id = v_tenant and pp.perfil = p_perfil;
end $$;

create function imobenviomassa.criar_perfil(p_nome text, p_descricao text default null) returns text
  language plpgsql security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
  v_base text;
  v_chave text;
begin
  if not imobenviomassa.eh_gestor_perfis() then
    perform imobenviomassa.erro('FORBIDDEN', 'Só Super Admin ou Admin com "Perfis e permissões" cria perfis.');
  end if;
  if length(btrim(coalesce(p_nome, ''))) < 2 then
    perform imobenviomassa.erro('INVALID', 'Informe o nome do perfil (mínimo 2 letras).');
  end if;
  v_base := left(trim(both '_' from regexp_replace(
              translate(lower(btrim(p_nome)), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
              '[^a-z0-9]+', '_', 'g')), 40);
  if v_base = '' then v_base := 'perfil'; end if;
  v_chave := v_base || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  insert into imobenviomassa.perfis (chave, nome, descricao, ordem, sistema, imobiliaria_id)
  values (v_chave, btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''), 50, false, v_tenant);
  perform imobenviomassa.registrar_auditoria('perfil_criado', 'perfil', v_chave, jsonb_build_object('nome', btrim(p_nome)));
  return v_chave;
exception when unique_violation then
  perform imobenviomassa.erro('DUPLICATE', 'Já existe um perfil com esse nome.');
  return null;
end $$;

create function imobenviomassa.editar_perfil(p_chave text, p_nome text, p_descricao text default null) returns void
  language plpgsql security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
  v_perfil imobenviomassa.perfis;
begin
  if not imobenviomassa.eh_gestor_perfis() then
    perform imobenviomassa.erro('FORBIDDEN', 'Só Super Admin ou Admin com "Perfis e permissões" edita perfis.');
  end if;
  select * into v_perfil from imobenviomassa.perfis where chave = p_chave;
  if v_perfil.chave is null or (v_perfil.imobiliaria_id is not null and v_perfil.imobiliaria_id <> v_tenant) then
    perform imobenviomassa.erro('NOT_FOUND', 'Perfil não encontrado.');
  end if;
  if v_perfil.sistema then
    perform imobenviomassa.erro('LOCKED', 'Os perfis do sistema não podem ser renomeados.');
  end if;
  update imobenviomassa.perfis
     set nome = coalesce(nullif(btrim(p_nome), ''), nome),
         descricao = nullif(btrim(coalesce(p_descricao, '')), '')
   where chave = p_chave;
  perform imobenviomassa.registrar_auditoria('perfil_editado', 'perfil', p_chave, jsonb_build_object('nome', p_nome));
exception when unique_violation then
  perform imobenviomassa.erro('DUPLICATE', 'Já existe um perfil com esse nome.');
end $$;

create function imobenviomassa.excluir_perfil(p_chave text) returns void
  language plpgsql security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
  v_perfil imobenviomassa.perfis;
begin
  if not imobenviomassa.eh_gestor_perfis() then
    perform imobenviomassa.erro('FORBIDDEN', 'Só Super Admin ou Admin com "Perfis e permissões" exclui perfis.');
  end if;
  select * into v_perfil from imobenviomassa.perfis where chave = p_chave;
  if v_perfil.chave is null or v_perfil.imobiliaria_id is distinct from v_tenant then
    perform imobenviomassa.erro('NOT_FOUND', 'Perfil não encontrado (os do sistema não podem ser excluídos).');
  end if;
  if exists (select 1 from imobenviomassa.usuarios u where u.perfil = p_chave) then
    perform imobenviomassa.erro('IN_USE', 'Há usuários com esse perfil. Troque o perfil deles antes de excluir.');
  end if;
  delete from imobenviomassa.perfis where chave = p_chave;
  perform imobenviomassa.registrar_auditoria('perfil_excluido', 'perfil', p_chave, jsonb_build_object('nome', v_perfil.nome));
end $$;

-- Salva as alterações da matriz de um perfil: p_alteracoes = [{"id": "ver_dashboard", "enabled": true}, …].
-- Valida o lote inteiro antes de gravar. Super Admin não tem matriz (tem tudo).
create function imobenviomassa.salvar_permissoes_perfil(p_perfil text, p_alteracoes jsonb) returns integer
  language plpgsql security definer set search_path to ''
as $$
declare
  v_tenant uuid := imobenviomassa.tenant_atual();
  v_perfil imobenviomassa.perfis;
  v_item jsonb;
  v_n integer := 0;
begin
  if not imobenviomassa.eh_gestor_perfis() then
    perform imobenviomassa.erro('FORBIDDEN', 'Só Super Admin ou Admin com "Perfis e permissões" altera permissões.');
  end if;
  select * into v_perfil from imobenviomassa.perfis where chave = p_perfil;
  if v_perfil.chave is null or (v_perfil.imobiliaria_id is not null and v_perfil.imobiliaria_id <> v_tenant) then
    perform imobenviomassa.erro('NOT_FOUND', 'Perfil não encontrado.');
  end if;
  if p_perfil = 'super_admin' then
    perform imobenviomassa.erro('LOCKED', 'O Super Admin tem acesso total e não é editável.');
  end if;
  if jsonb_typeof(p_alteracoes) <> 'array' then
    perform imobenviomassa.erro('INVALID', 'Lista de alterações inválida.');
  end if;
  for v_item in select * from jsonb_array_elements(p_alteracoes) loop
    if coalesce(v_item->>'id', '') !~ '^[a-z0-9_]{2,60}$' or jsonb_typeof(v_item->'enabled') <> 'boolean' then
      perform imobenviomassa.erro('INVALID', 'Permissão inválida: ' || coalesce(v_item->>'id', '(vazia)'));
    end if;
    if v_item->>'id' in ('home', 'treinamento', 'conta_seguranca') then
      perform imobenviomassa.erro('LOCKED', 'Item sempre visível: ' || (v_item->>'id'));
    end if;
  end loop;
  for v_item in select * from jsonb_array_elements(p_alteracoes) loop
    insert into imobenviomassa.perfil_permissoes (imobiliaria_id, perfil, permission_id, enabled, atualizado_por)
    values (v_tenant, p_perfil, v_item->>'id', (v_item->>'enabled')::boolean, auth.uid())
    on conflict (imobiliaria_id, perfil, permission_id) do update
      set enabled = excluded.enabled, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
    v_n := v_n + 1;
  end loop;
  perform imobenviomassa.registrar_auditoria('permissoes_salvas', 'perfil', p_perfil,
    jsonb_build_object('alteracoes', p_alteracoes));
  return v_n;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. Campanhas, destinatários e DocuSign (mesmas colunas do app + imobiliaria_id)
-- ---------------------------------------------------------------------------------------------------
create type imobenviomassa.wa_campanha_status as enum ('rascunho','rascunho_confirmado','em_execucao','concluida','erro','cancelada');
create type imobenviomassa.wa_destinatario_status as enum ('pendente','enviado','entregue','assinado','erro','opt_out');
create type imobenviomassa.wa_campanha_origem as enum ('totvs','excel');

create table imobenviomassa.wa_campanhas (
  id                   uuid primary key default gen_random_uuid(),
  imobiliaria_id       uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  nome                 text not null,
  criado_por           uuid not null references auth.users(id) on delete restrict,
  origem               imobenviomassa.wa_campanha_origem not null,
  filtros_origem       jsonb not null default '{}'::jsonb,
  modelo_docusign_id   text,
  modelo_docusign_nome text,
  config_assinatura    jsonb not null default '{}'::jsonb,
  mensagem_whatsapp    text not null default '',
  status               imobenviomassa.wa_campanha_status not null default 'rascunho',
  totais               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, imobiliaria_id)
);
create index wa_campanhas_imob_created_idx on imobenviomassa.wa_campanhas (imobiliaria_id, created_at desc);
create index wa_campanhas_criado_por_idx on imobenviomassa.wa_campanhas (criado_por, created_at desc);
create trigger wa_campanhas_tocar before update on imobenviomassa.wa_campanhas
  for each row execute function imobenviomassa.tocar_updated_at();

create table imobenviomassa.wa_campanha_destinatarios (
  id                   uuid primary key default gen_random_uuid(),
  imobiliaria_id       uuid not null,
  campanha_id          uuid not null,
  nome                 text not null,
  cpf                  text,
  telefone             text,
  email                text,
  empreendimento       text,
  bloco                text,
  unidade              text,
  dados_extras         jsonb not null default '{}'::jsonb,
  status               imobenviomassa.wa_destinatario_status not null default 'pendente',
  erro_msg             text,
  envelope_docusign_id text,
  enviado_em           timestamptz,
  assinado_em          timestamptz,
  anonimizado_em       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (campanha_id, imobiliaria_id)
    references imobenviomassa.wa_campanhas (id, imobiliaria_id) on delete cascade
);
create index wa_destinatarios_campanha_idx on imobenviomassa.wa_campanha_destinatarios (campanha_id);
create index wa_destinatarios_envelope_idx on imobenviomassa.wa_campanha_destinatarios (envelope_docusign_id)
  where envelope_docusign_id is not null;
create index wa_destinatarios_anonimizado_idx on imobenviomassa.wa_campanha_destinatarios (anonimizado_em)
  where anonimizado_em is null;
create trigger wa_destinatarios_tocar before update on imobenviomassa.wa_campanha_destinatarios
  for each row execute function imobenviomassa.tocar_updated_at();

-- Configuração DocuSign: uma por imobiliária. Segredos no Vault (docusign_rsa_private_key_<imob>,
-- docusign_webhook_secret_<imob>); as colunas são fallback quando o Vault não está ativo. Só service_role.
create table imobenviomassa.docusign_config (
  id                     uuid primary key default gen_random_uuid(),
  imobiliaria_id         uuid not null unique references imobenviomassa.imobiliarias(id) on delete cascade,
  ambiente               text not null default 'demo' check (ambiente in ('demo','producao')),
  base_url               text not null default 'https://demo.docusign.net/restapi/v2.1',
  auth_url               text not null default 'https://account-d.docusign.com',
  account_id             text,
  integration_key        text,
  impersonated_user_id   text,
  rsa_private_key        text,
  default_template_id    text,
  webhook_secret         text,
  access_token_cache     text,
  access_token_expira_em timestamptz,
  ativo                  boolean not null default true,
  updated_at             timestamptz not null default now(),
  updated_by             uuid
);
create trigger docusign_config_tocar before update on imobenviomassa.docusign_config
  for each row execute function imobenviomassa.tocar_updated_at();

create table imobenviomassa.docusign_envelopes (
  id              uuid primary key default gen_random_uuid(),
  imobiliaria_id  uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  campanha_id     uuid,
  destinatario_id uuid references imobenviomassa.wa_campanha_destinatarios(id) on delete set null,
  envelope_id     text not null unique,
  template_id     text,
  status          text,
  sent_at         timestamptz,
  completed_at    timestamptz,
  declined_at     timestamptz,
  voided_at       timestamptz,
  last_event_at   timestamptz default now(),
  raw             jsonb,
  created_at      timestamptz not null default now(),
  foreign key (campanha_id, imobiliaria_id)
    references imobenviomassa.wa_campanhas (id, imobiliaria_id) on delete cascade
);
create index docusign_envelopes_campanha_idx on imobenviomassa.docusign_envelopes (campanha_id);
create index docusign_envelopes_status_idx on imobenviomassa.docusign_envelopes (status);

-- ---------------------------------------------------------------------------------------------------
-- 7. LGPD: opt-out e retenção (por imobiliária)
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.wa_opt_outs (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  tipo           text not null check (tipo in ('cpf', 'email', 'telefone')),
  valor          text not null,
  motivo         text,
  origem         text not null default 'manual',
  criado_por     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (imobiliaria_id, tipo, valor)
);

create table imobenviomassa.wa_retencao_config (
  imobiliaria_id          uuid primary key references imobenviomassa.imobiliarias(id) on delete cascade,
  destinatarios_meses     integer not null default 12 check (destinatarios_meses between 1 and 120),
  campanhas_abertas_meses integer not null default 18 check (campanhas_abertas_meses between 1 and 120)
);

-- ---------------------------------------------------------------------------------------------------
-- 8. TOTVS RM (credenciais por imobiliária; senha no Vault rm_senha_<imob>) e Gateway de APIs
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.integracao_rm (
  imobiliaria_id uuid primary key references imobenviomassa.imobiliarias(id) on delete cascade,
  usuario        text not null default '',
  senha          text not null default '',          -- fallback sem Vault
  atualizado_em  timestamptz not null default now(),
  atualizado_por text not null default ''
);

create table imobenviomassa.integracao_rm_recurso (
  imobiliaria_id  uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  recurso         text not null check (recurso in ('empreendimentos', 'compradores')),
  endpoint        text not null default '',
  ultima_consulta timestamptz,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text not null default '',
  primary key (imobiliaria_id, recurso)
);

create table imobenviomassa.api_registry (
  id                     uuid primary key default gen_random_uuid(),
  imobiliaria_id         uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  name                   text not null,
  endpoint               text not null,
  method                 text not null default 'GET',
  auth_type              text not null default 'none',
  auth_secret_ref        text,                      -- nome do secret (GW_*), nunca o valor
  base_url               text,
  description            text,
  params_schema          jsonb,
  soap_service           text,
  soap_action            text,
  soap_envelope_template text,
  soap_response_path     text,
  source                 text,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (imobiliaria_id, name)
);
create trigger api_registry_tocar before update on imobenviomassa.api_registry
  for each row execute function imobenviomassa.tocar_updated_at();

-- Catálogo de envelopes SOAP do RM (comum a todas as imobiliárias).
create table imobenviomassa.soap_envelope_templates (
  id            uuid primary key default gen_random_uuid(),
  key           text not null,
  service       text not null,
  action        text not null,
  envelope_xml  text not null,
  response_path text,
  description   text,
  version       integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (key, version)
);

create table imobenviomassa.gateway_call_log (
  id               uuid primary key default gen_random_uuid(),
  imobiliaria_id   uuid references imobenviomassa.imobiliarias(id) on delete cascade,
  user_id          uuid,
  api_id           uuid,
  api_name         text,
  kind             text not null,
  status           text not null,
  request_payload  jsonb,
  response_payload jsonb,
  http_status      integer,
  duration_ms      integer,
  error_message    text,
  created_at       timestamptz not null default now()
);
create index gateway_call_log_created_idx on imobenviomassa.gateway_call_log (created_at);

-- ---------------------------------------------------------------------------------------------------
-- 9. Limite de tentativas de login (global: o login acontece antes de saber a imobiliária)
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.auth_tentativas (
  chave             text primary key,               -- 'conta:<email>' | 'ip:<ip>'
  falhas            integer not null default 0,
  primeira_falha_em timestamptz,
  ultima_falha_em   timestamptz,
  bloqueado_ate     timestamptz,
  bloqueios         integer not null default 0
);

create table imobenviomassa.auth_login_log (
  id         bigserial primary key,
  email_norm text,
  user_id    uuid,
  ip         text,
  user_agent text,
  origem     text not null default 'login',
  resultado  text not null,
  created_at timestamptz not null default now()
);
create index auth_login_log_created_idx on imobenviomassa.auth_login_log (created_at desc);
create index auth_login_log_email_idx on imobenviomassa.auth_login_log (email_norm, created_at desc);

-- Mantida para auth_desbloquear/auth_bloqueio_de (o hook de senha não é instalado no ikvj compartilhado).
create table imobenviomassa.auth_falhas_por_usuario (
  user_id           uuid primary key,
  falhas            integer not null default 0,
  primeira_falha_em timestamptz,
  ultima_falha_em   timestamptz,
  bloqueado_ate     timestamptz,
  bloqueios         integer not null default 0
);

create table imobenviomassa.auth_bloqueio_config (
  id                  boolean primary key default true check (id),
  max_falhas          integer not null default 5,
  janela_minutos      integer not null default 15,
  bloqueio_minutos    integer not null default 15,
  bloqueio_max_horas  integer not null default 24,
  max_falhas_ip       integer not null default 20,
  bloqueio_ip_minutos integer not null default 15
);
insert into imobenviomassa.auth_bloqueio_config (id) values (true);

create function imobenviomassa.auth_bloqueio_parametros()
  returns table (max_falhas int, janela_minutos int, bloqueio_minutos int, bloqueio_max_horas int,
                 max_falhas_ip int, bloqueio_ip_minutos int)
  language sql stable security definer set search_path to ''
as $$
  select coalesce(c.max_falhas, 5), coalesce(c.janela_minutos, 15), coalesce(c.bloqueio_minutos, 15),
         coalesce(c.bloqueio_max_horas, 24), coalesce(c.max_falhas_ip, 20), coalesce(c.bloqueio_ip_minutos, 15)
    from (select 1) x left join imobenviomassa.auth_bloqueio_config c on c.id
$$;

-- Antes de autenticar: reserva a tentativa (conta + IP) e bloqueia se já passou do limite.
create function imobenviomassa.auth_pre_login(p_email text, p_ip text) returns jsonb
  language plpgsql security definer set search_path to ''
as $$
declare
  cfg record;
  v_email text := lower(coalesce(p_email, ''));
  v_ip text := coalesce(p_ip, '');
  v_chaves text[];
  k text;
  v_max int;
  v_bloqueio interval;
  v_backoff boolean;
  t record;
  v_ate timestamptz;
begin
  select * into cfg from imobenviomassa.auth_bloqueio_parametros();
  v_chaves := array['conta:' || v_email];
  if v_ip <> '' and v_ip <> 'desconhecido' then
    v_chaves := v_chaves || ('ip:' || v_ip);
  end if;
  foreach k in array v_chaves loop
    if k like 'conta:%' then
      v_max := cfg.max_falhas; v_bloqueio := make_interval(mins => cfg.bloqueio_minutos); v_backoff := true;
    else
      v_max := cfg.max_falhas_ip; v_bloqueio := make_interval(mins => cfg.bloqueio_ip_minutos); v_backoff := false;
    end if;
    insert into imobenviomassa.auth_tentativas (chave, falhas, primeira_falha_em, ultima_falha_em)
    values (k, 1, now(), now())
    on conflict (chave) do update set
      falhas = case
        when imobenviomassa.auth_tentativas.primeira_falha_em is null
          or imobenviomassa.auth_tentativas.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
        then 1 else imobenviomassa.auth_tentativas.falhas + 1 end,
      primeira_falha_em = case
        when imobenviomassa.auth_tentativas.primeira_falha_em is null
          or imobenviomassa.auth_tentativas.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
        then now() else imobenviomassa.auth_tentativas.primeira_falha_em end,
      ultima_falha_em = now()
    returning * into t;
    if t.bloqueado_ate is not null and t.bloqueado_ate > now() then
      v_ate := greatest(coalesce(v_ate, t.bloqueado_ate), t.bloqueado_ate);
      continue;
    end if;
    if t.falhas > v_max then
      update imobenviomassa.auth_tentativas a
         set bloqueios = a.bloqueios + 1,
             bloqueado_ate = now() + case when v_backoff
               then least(v_bloqueio * power(2, a.bloqueios), make_interval(hours => cfg.bloqueio_max_horas))
               else v_bloqueio end,
             falhas = 0,
             primeira_falha_em = null
       where a.chave = k
       returning a.bloqueado_ate into v_ate;
    end if;
  end loop;
  if v_ate is not null then
    return jsonb_build_object('permitido', false, 'ate', v_ate);
  end if;
  return jsonb_build_object('permitido', true);
end $$;

-- Depois de autenticar: registra o resultado. Sucesso zera os contadores.
create function imobenviomassa.auth_registrar_resultado(
  p_email text, p_ip text, p_ok boolean, p_user_id uuid default null, p_ua text default null,
  p_origem text default 'login', p_resultado text default null
) returns jsonb
  language plpgsql security definer set search_path to ''
as $$
declare
  cfg record;
  v_email text := lower(coalesce(p_email, ''));
  v_ip text := coalesce(p_ip, '');
  v_bloqueado boolean := false;
  v_ate timestamptz;
  v_tmp timestamptz;
begin
  select * into cfg from imobenviomassa.auth_bloqueio_parametros();
  insert into imobenviomassa.auth_login_log (email_norm, user_id, ip, user_agent, origem, resultado)
  values (v_email, p_user_id, nullif(v_ip, ''), left(p_ua, 300), coalesce(p_origem, 'login'),
          coalesce(p_resultado, case when p_ok then 'ok' else 'credencial_invalida' end));
  if p_ok then
    delete from imobenviomassa.auth_tentativas where chave = 'conta:' || v_email or (v_ip <> '' and chave = 'ip:' || v_ip);
    if p_user_id is not null then
      delete from imobenviomassa.auth_falhas_por_usuario where user_id = p_user_id;
    end if;
    return jsonb_build_object('bloqueado', false);
  end if;
  update imobenviomassa.auth_tentativas a
     set bloqueios = a.bloqueios + 1,
         bloqueado_ate = now() + least(make_interval(mins => cfg.bloqueio_minutos) * power(2, a.bloqueios),
                                       make_interval(hours => cfg.bloqueio_max_horas)),
         falhas = 0,
         primeira_falha_em = null
   where a.chave = 'conta:' || v_email
     and a.falhas >= cfg.max_falhas
     and (a.bloqueado_ate is null or a.bloqueado_ate <= now())
   returning a.bloqueado_ate into v_tmp;
  if v_tmp is not null then v_bloqueado := true; v_ate := v_tmp; end if;
  if v_ip <> '' and v_ip <> 'desconhecido' then
    v_tmp := null;
    update imobenviomassa.auth_tentativas a
       set bloqueios = a.bloqueios + 1,
           bloqueado_ate = now() + make_interval(mins => cfg.bloqueio_ip_minutos),
           falhas = 0,
           primeira_falha_em = null
     where a.chave = 'ip:' || v_ip
       and a.falhas >= cfg.max_falhas_ip
       and (a.bloqueado_ate is null or a.bloqueado_ate <= now())
     returning a.bloqueado_ate into v_tmp;
    if v_tmp is not null then v_bloqueado := true; v_ate := greatest(coalesce(v_ate, v_tmp), v_tmp); end if;
  end if;
  return jsonb_build_object('bloqueado', v_bloqueado, 'ate', v_ate);
end $$;

create function imobenviomassa.auth_desbloquear(p_email text, p_user_id uuid) returns void
  language plpgsql security definer set search_path to ''
as $$
begin
  delete from imobenviomassa.auth_tentativas where chave = 'conta:' || lower(coalesce(p_email, ''));
  if p_user_id is not null then
    delete from imobenviomassa.auth_falhas_por_usuario where user_id = p_user_id;
  end if;
end $$;

create function imobenviomassa.auth_bloqueio_de(p_email text, p_user_id uuid) returns timestamptz
  language sql stable security definer set search_path to ''
as $$
  select greatest(
    (select t.bloqueado_ate from imobenviomassa.auth_tentativas t
      where t.chave = 'conta:' || lower(coalesce(p_email, '')) and t.bloqueado_ate > now()),
    (select f.bloqueado_ate from imobenviomassa.auth_falhas_por_usuario f
      where f.user_id = p_user_id and f.bloqueado_ate > now()))
$$;

-- Cadastro de usuário: a conta pode já existir no login compartilhado (ImobSystem, Imobsuprimentos, ImobDoces).
create function imobenviomassa.auth_id_por_email(p_email text) returns uuid
  language sql stable security definer set search_path to ''
as $$ select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1 $$;

-- Troca de senha: derruba as outras sessões (a conta é compartilhada com os outros apps do ikvj).
create function imobenviomassa.auth_revogar_sessoes(p_user_id uuid, p_manter_sessao uuid default null) returns integer
  language plpgsql security definer set search_path to ''
as $$
declare
  v_n integer;
begin
  delete from auth.sessions s
   where s.user_id = p_user_id and (p_manter_sessao is null or s.id <> p_manter_sessao);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. Segredos no Vault (só service_role). Nomes: ^(rm|docusign)_[a-z0-9_]{1,60}$
-- ---------------------------------------------------------------------------------------------------
create function imobenviomassa.sufixo_imob(p_imobiliaria uuid) returns text
  language sql immutable set search_path to ''
as $$ select replace(p_imobiliaria::text, '-', '') $$;

create function imobenviomassa.wa_segredo_gravar(p_nome text, p_valor text, p_descricao text default null) returns uuid
  language plpgsql security definer set search_path to ''
as $$
declare
  v_id uuid;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if p_valor is null or p_valor = '' then
    raise exception 'segredo_valor_vazio' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    raise exception 'vault_indisponivel';
  end if;
  execute 'select id from vault.secrets where name = $1' into v_id using 'imobenviomassa_' || p_nome;
  if v_id is null then
    execute 'select vault.create_secret($1, $2, $3)' into v_id using p_valor, 'imobenviomassa_' || p_nome, coalesce(p_descricao, '');
  else
    execute 'select vault.update_secret($1, $2, $3, $4)' using v_id, p_valor, 'imobenviomassa_' || p_nome, coalesce(p_descricao, '');
  end if;
  return v_id;
end $$;

create function imobenviomassa.wa_segredo_ler(p_nome text) returns text
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_valor text;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_valor using 'imobenviomassa_' || p_nome;
  return v_valor;
end $$;

create function imobenviomassa.wa_segredo_existe(p_nome text) returns boolean
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_existe boolean;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return false;
  end if;
  execute 'select exists (select 1 from vault.secrets where name = $1)' into v_existe using 'imobenviomassa_' || p_nome;
  return coalesce(v_existe, false);
end $$;

-- RM: credenciais com a senha (servidor do app e Edge Functions). Senha: coluna (fallback) ou Vault.
create function imobenviomassa.rm_credenciais(p_imobiliaria uuid, p_recurso text default 'empreendimentos')
  returns table (endpoint text, usuario text, senha text)
  language sql stable security definer set search_path to ''
as $$
  select r.endpoint, i.usuario,
         coalesce(nullif(i.senha, ''), imobenviomassa.wa_segredo_ler('rm_senha_' || imobenviomassa.sufixo_imob(p_imobiliaria)), '')
    from imobenviomassa.integracao_rm i
    join imobenviomassa.integracao_rm_recurso r
      on r.imobiliaria_id = i.imobiliaria_id and r.recurso = coalesce(p_recurso, 'empreendimentos')
   where i.imobiliaria_id = p_imobiliaria
$$;

create function imobenviomassa.rm_credenciais_salvar(
  p_imobiliaria uuid, p_endpoint text, p_usuario text, p_senha text, p_autor text, p_recurso text default 'empreendimentos'
) returns void
  language plpgsql security definer set search_path to ''
as $$
declare
  v_recurso text := coalesce(nullif(btrim(p_recurso), ''), 'empreendimentos');
  v_senha text := coalesce(p_senha, '');
  v_no_vault boolean := false;
begin
  if v_recurso not in ('empreendimentos', 'compradores') then
    raise exception 'Integração desconhecida: %', v_recurso using errcode = '22023';
  end if;
  if v_senha <> '' then
    begin
      perform imobenviomassa.wa_segredo_gravar('rm_senha_' || imobenviomassa.sufixo_imob(p_imobiliaria), v_senha,
        'Senha do usuário do TOTVS RM (Imobenviomassa)');
      v_no_vault := true;
    exception when others then
      v_no_vault := false;
      raise warning 'rm_credenciais_salvar: Vault indisponível; senha mantida na coluna (SQLSTATE %)', sqlstate;
    end;
  end if;
  insert into imobenviomassa.integracao_rm (imobiliaria_id, usuario, senha, atualizado_em, atualizado_por)
  values (p_imobiliaria, btrim(coalesce(p_usuario, '')), case when v_no_vault then '' else v_senha end, now(), coalesce(p_autor, ''))
  on conflict (imobiliaria_id) do update
    set usuario        = case when excluded.usuario = '' then imobenviomassa.integracao_rm.usuario else excluded.usuario end,
        senha          = case when v_senha = '' then imobenviomassa.integracao_rm.senha else excluded.senha end,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;
  insert into imobenviomassa.integracao_rm_recurso (imobiliaria_id, recurso, endpoint, atualizado_em, atualizado_por)
  values (p_imobiliaria, v_recurso, btrim(coalesce(p_endpoint, '')), now(), coalesce(p_autor, ''))
  on conflict (imobiliaria_id, recurso) do update
    set endpoint = excluded.endpoint, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
end $$;

create function imobenviomassa.rm_status(p_imobiliaria uuid)
  returns table (recurso text, configurado boolean, endpoint text, usuario text, atualizado_em timestamptz,
                 atualizado_por text, ultima_consulta timestamptz)
  language sql stable security definer set search_path to ''
as $$
  select r.recurso,
         (r.endpoint <> '' and i.usuario <> ''
           and (i.senha <> '' or imobenviomassa.wa_segredo_existe('rm_senha_' || imobenviomassa.sufixo_imob(p_imobiliaria)))),
         r.endpoint, i.usuario,
         greatest(r.atualizado_em, i.atualizado_em),
         case when r.atualizado_em >= i.atualizado_em then r.atualizado_por else i.atualizado_por end,
         r.ultima_consulta
    from imobenviomassa.integracao_rm_recurso r
    join imobenviomassa.integracao_rm i on i.imobiliaria_id = r.imobiliaria_id
   where r.imobiliaria_id = p_imobiliaria
   order by r.recurso desc
$$;

create function imobenviomassa.rm_consulta_registrar(p_imobiliaria uuid, p_recurso text) returns void
  language sql security definer set search_path to ''
as $$
  update imobenviomassa.integracao_rm_recurso set ultima_consulta = now()
   where imobiliaria_id = p_imobiliaria and recurso = p_recurso
$$;

-- ---------------------------------------------------------------------------------------------------
-- 11. LGPD: anonimização e direitos do titular (sempre dentro de uma imobiliária)
-- ---------------------------------------------------------------------------------------------------
create function imobenviomassa.wa_norm_tel(p text) returns text
  language sql immutable set search_path to ''
as $$
  select case when length(d) in (12, 13) and d like '55%' then substr(d, 3) else d end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create function imobenviomassa.wa_anonimizar_linhas(p_ids uuid[]) returns integer
  language plpgsql security definer set search_path to ''
as $$
declare
  v_n integer;
begin
  if p_ids is null or cardinality(p_ids) = 0 then return 0; end if;
  update imobenviomassa.docusign_envelopes e set raw = null
   where e.raw is not null
     and (e.destinatario_id = any (p_ids)
          or e.envelope_id in (select d.envelope_docusign_id from imobenviomassa.wa_campanha_destinatarios d
                                where d.id = any (p_ids) and d.envelope_docusign_id is not null));
  update imobenviomassa.wa_campanha_destinatarios d
     set nome = 'Anonimizado', cpf = null, telefone = null, email = null, bloco = null, unidade = null,
         dados_extras = '{}'::jsonb, erro_msg = null, anonimizado_em = now()
   where d.id = any (p_ids) and d.anonimizado_em is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function imobenviomassa.wa_anonimizar_campanha(p_imobiliaria uuid, p_campanha_id uuid) returns integer
  language sql security definer set search_path to ''
as $$
  select imobenviomassa.wa_anonimizar_linhas(coalesce(
    (select array_agg(d.id) from imobenviomassa.wa_campanha_destinatarios d
      where d.imobiliaria_id = p_imobiliaria and d.campanha_id = p_campanha_id and d.anonimizado_em is null),
    '{}'::uuid[]))
$$;

create function imobenviomassa.wa_anonimizar_titular(
  p_imobiliaria uuid, p_cpf text default null, p_email text default null, p_telefone text default null
) returns integer
  language plpgsql security definer set search_path to ''
as $$
declare
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(imobenviomassa.wa_norm_tel(p_telefone), '');
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
    from imobenviomassa.wa_campanha_destinatarios d
   where d.imobiliaria_id = p_imobiliaria and d.anonimizado_em is null
     and ((v_cpf is not null and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf)
       or (v_email is not null and lower(coalesce(d.email, '')) = v_email)
       or (v_tel is not null and imobenviomassa.wa_norm_tel(d.telefone) = v_tel));
  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_conjuges
    from imobenviomassa.wa_campanha_destinatarios d
   where d.imobiliaria_id = p_imobiliaria and d.anonimizado_em is null
     and d.id <> all (v_principais)
     and ((v_cpf is not null and regexp_replace(coalesce(d.dados_extras->>'cpf_conjuge', ''), '\D', '', 'g') = v_cpf)
       or (v_email is not null and lower(coalesce(d.dados_extras->>'email_conjuge', '')) = v_email)
       or (v_tel is not null and imobenviomassa.wa_norm_tel(d.dados_extras->>'telefone_conjuge') = v_tel));
  v_n := imobenviomassa.wa_anonimizar_linhas(v_principais);
  update imobenviomassa.wa_campanha_destinatarios d
     set dados_extras = d.dados_extras - 'nome_conjuge' - 'email_conjuge' - 'telefone_conjuge' - 'cpf_conjuge'
   where d.id = any (v_conjuges);
  get diagnostics v_c = row_count;
  update imobenviomassa.docusign_envelopes e set raw = null
   where e.raw is not null
     and e.envelope_id in (select d.envelope_docusign_id from imobenviomassa.wa_campanha_destinatarios d
                            where d.id = any (v_conjuges) and d.envelope_docusign_id is not null);
  return v_n + v_c;
end $$;

create function imobenviomassa.wa_titular_ocorrencias(
  p_imobiliaria uuid, p_cpf text default null, p_email text default null, p_telefone text default null
) returns table (destinatario_id uuid, campanha_id uuid, campanha_nome text, campanha_criada_em timestamptz,
                 status text, empreendimento text, enviado_em timestamptz, papel text, anonimizado_em timestamptz)
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_tel text := nullif(imobenviomassa.wa_norm_tel(p_telefone), '');
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
             or (v_tel is not null and imobenviomassa.wa_norm_tel(d.telefone) = v_tel)
           then 'comprador' else 'conjuge' end,
         d.anonimizado_em
    from imobenviomassa.wa_campanha_destinatarios d
    join imobenviomassa.wa_campanhas c on c.id = d.campanha_id
   where d.imobiliaria_id = p_imobiliaria and d.anonimizado_em is null
     and ((v_cpf is not null and (regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = v_cpf
                               or regexp_replace(coalesce(d.dados_extras->>'cpf_conjuge', ''), '\D', '', 'g') = v_cpf))
       or (v_email is not null and (lower(coalesce(d.email, '')) = v_email
                                 or lower(coalesce(d.dados_extras->>'email_conjuge', '')) = v_email))
       or (v_tel is not null and (imobenviomassa.wa_norm_tel(d.telefone) = v_tel
                               or imobenviomassa.wa_norm_tel(d.dados_extras->>'telefone_conjuge') = v_tel)))
   order by c.created_at desc
   limit 200;
end $$;

-- Retenção diária (todas as imobiliárias, cada uma com seus prazos).
create function imobenviomassa.wa_retencao_executar() returns table (tabela text, apagados bigint)
  language plpgsql security definer set search_path to ''
as $$
declare
  n bigint;
  v_ids uuid[];
begin
  delete from imobenviomassa.gateway_call_log where created_at < now() - interval '30 days';
  get diagnostics n = row_count; tabela := 'gateway_call_log'; apagados := n; return next;

  delete from imobenviomassa.auth_login_log where created_at < now() - interval '180 days';
  get diagnostics n = row_count; tabela := 'auth_login_log'; apagados := n; return next;

  delete from imobenviomassa.auth_tentativas where coalesce(bloqueado_ate, ultima_falha_em, now()) < now() - interval '1 day';
  get diagnostics n = row_count; tabela := 'auth_tentativas'; apagados := n; return next;

  delete from imobenviomassa.auth_falhas_por_usuario where coalesce(bloqueado_ate, ultima_falha_em, now()) < now() - interval '1 day';
  get diagnostics n = row_count; tabela := 'auth_falhas_por_usuario'; apagados := n; return next;

  delete from imobenviomassa.wa_auditoria where created_at < now() - interval '2 years';
  get diagnostics n = row_count; tabela := 'wa_auditoria'; apagados := n; return next;

  select coalesce(array_agg(d.id), '{}'::uuid[]) into v_ids
    from imobenviomassa.wa_campanha_destinatarios d
    join imobenviomassa.wa_campanhas c on c.id = d.campanha_id
    left join imobenviomassa.wa_retencao_config r on r.imobiliaria_id = c.imobiliaria_id
   where d.anonimizado_em is null
     and ((c.status in ('concluida', 'erro', 'cancelada')
           and c.updated_at < now() - make_interval(months => coalesce(r.destinatarios_meses, 12)))
       or c.created_at < now() - make_interval(months => coalesce(r.campanhas_abertas_meses, 18)));
  n := imobenviomassa.wa_anonimizar_linhas(v_ids);
  tabela := 'wa_campanha_destinatarios (anonimizados)'; apagados := n; return next;

  update imobenviomassa.docusign_envelopes e set raw = null
    from (select i.id, coalesce(r.destinatarios_meses, 12) as meses
            from imobenviomassa.imobiliarias i
            left join imobenviomassa.wa_retencao_config r on r.imobiliaria_id = i.id) x
   where e.imobiliaria_id = x.id and e.raw is not null and e.created_at < now() - make_interval(months => x.meses);
  get diagnostics n = row_count; tabela := 'docusign_envelopes (raw limpo)'; apagados := n; return next;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. Provisionamento de imobiliária (linhas padrão; idempotente)
-- ---------------------------------------------------------------------------------------------------
create function imobenviomassa.provisionar_imobiliaria(p_imobiliaria uuid) returns void
  language plpgsql security definer set search_path to ''
as $$
begin
  insert into imobenviomassa.wa_retencao_config (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.integracao_rm (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.integracao_rm_recurso (imobiliaria_id, recurso)
  values (p_imobiliaria, 'empreendimentos'), (p_imobiliaria, 'compradores') on conflict do nothing;
  -- Liberações iniciais = as dos 3 níveis do app (REGRAS_DO_NIVEL em src/lib/permissoes.ts).
  insert into imobenviomassa.perfil_permissoes (imobiliaria_id, perfil, permission_id, enabled)
  select p_imobiliaria, r.perfil, r.permission_id, true
    from (values
      ('admin', 'disparos'), ('admin', 'docusign'), ('admin', 'ver_dashboard'), ('admin', 'criar_disparo'),
      ('admin', 'ver_historico'), ('admin', 'ver_relatorios'), ('admin', 'gateway_apis'),
      ('admin', 'view_audit_logs'), ('admin', 'manage_privacy'),
      ('analista', 'disparos'), ('analista', 'docusign'), ('analista', 'ver_dashboard'),
      ('analista', 'criar_disparo'), ('analista', 'ver_historico'), ('analista', 'ver_relatorios')
    ) as r(perfil, permission_id)
  on conflict do nothing;
end $$;

create function imobenviomassa.imobiliarias_provisionar() returns trigger
  language plpgsql security definer set search_path to ''
as $$ begin perform imobenviomassa.provisionar_imobiliaria(new.id); return new; end $$;
create trigger imobiliarias_provisionar after insert on imobenviomassa.imobiliarias
  for each row execute function imobenviomassa.imobiliarias_provisionar();

-- ---------------------------------------------------------------------------------------------------
-- 13. RLS (tudo ligado; o que não tem policy é só service_role)
-- ---------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'imobenviomassa' loop
    execute format('alter table imobenviomassa.%I enable row level security', t);
  end loop;
end $$;

create policy propria_ler on imobenviomassa.imobiliarias for select to authenticated
  using (id = (select imobenviomassa.tenant_atual()));

create policy visiveis_ler on imobenviomassa.perfis for select to authenticated
  using (imobiliaria_id is null or imobiliaria_id = (select imobenviomassa.tenant_atual()));

create policy proprio_ou_gestor_ler on imobenviomassa.usuarios for select to authenticated
  using (id = (select auth.uid())
         or (imobiliaria_id = (select imobenviomassa.tenant_atual()) and (select imobenviomassa.tem_permissao('manage_users'))));

create policy tenant_ler on imobenviomassa.perfil_permissoes for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual()));

-- Campanhas: o criador vê as suas; Admin e Super Admin veem as da imobiliária (regra do app original).
create policy criador_ou_admin_ler on imobenviomassa.wa_campanhas for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and (criado_por = (select auth.uid()) or (select imobenviomassa.sou_admin())));

create policy criador_ou_admin_ler on imobenviomassa.wa_campanha_destinatarios for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and exists (select 1 from imobenviomassa.wa_campanhas c
                      where c.id = campanha_id
                        and (c.criado_por = (select auth.uid()) or (select imobenviomassa.sou_admin()))));

create policy admin_ler on imobenviomassa.docusign_envelopes for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada()) and (select imobenviomassa.sou_admin()));

create policy admin_ler on imobenviomassa.api_registry for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada()) and (select imobenviomassa.sou_admin()));

-- ---------------------------------------------------------------------------------------------------
-- 14. Privilégios: tudo fechado, depois só o necessário (os defaults da 01 davam CRUD ao authenticated)
-- ---------------------------------------------------------------------------------------------------
revoke all on all tables in schema imobenviomassa from public, anon, authenticated;
revoke all on all sequences in schema imobenviomassa from public, anon, authenticated;
revoke all on all functions in schema imobenviomassa from public, anon, authenticated;
grant all on all tables in schema imobenviomassa to service_role;
grant all on all sequences in schema imobenviomassa to service_role;
grant execute on all functions in schema imobenviomassa to service_role;

-- Leitura pelo navegador (RLS decide as linhas).
grant select on imobenviomassa.imobiliarias, imobenviomassa.perfis, imobenviomassa.usuarios,
  imobenviomassa.perfil_permissoes, imobenviomassa.wa_campanhas, imobenviomassa.docusign_envelopes,
  imobenviomassa.api_registry to authenticated;
-- Destinatários: sem CPF, telefone, e-mail e dados_extras no navegador (dados pessoais só pelo servidor).
grant select (id, imobiliaria_id, campanha_id, nome, empreendimento, bloco, unidade, status, erro_msg,
              envelope_docusign_id, enviado_em, assinado_em, anonimizado_em, created_at, updated_at)
  on imobenviomassa.wa_campanha_destinatarios to authenticated;

grant execute on function
  imobenviomassa.tenant_atual(), imobenviomassa.meu_perfil(), imobenviomassa.conta_liberada(),
  imobenviomassa.sou_admin(), imobenviomassa.tem_permissao(text), imobenviomassa.meu_acesso(),
  imobenviomassa.concluir_troca_senha(), imobenviomassa.registrar_acesso(), imobenviomassa.eh_gestor_perfis(),
  imobenviomassa.listar_perfis(), imobenviomassa.regras_do_perfil(text), imobenviomassa.criar_perfil(text, text),
  imobenviomassa.editar_perfil(text, text, text), imobenviomassa.excluir_perfil(text),
  imobenviomassa.salvar_permissoes_perfil(text, jsonb)
  to authenticated;

-- Funções de trigger e internas: nem o authenticated executa direto.
revoke execute on function imobenviomassa.usuarios_preencher(), imobenviomassa.imobiliarias_provisionar(),
  imobenviomassa.provisionar_imobiliaria(uuid), imobenviomassa.registrar_auditoria(text, text, text, jsonb),
  imobenviomassa.tem_permissao_de(uuid, text)
  from authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 15. Central de acessos: registra o app (controle desligado até o super admin ligar)
-- ---------------------------------------------------------------------------------------------------
insert into acessos.aplicativos (schema_name, nome, url)
values ('imobenviomassa', 'ImobSystem Envio em Massa', 'https://enviomassa.imobsystems.com.br')
on conflict (schema_name) do nothing;

-- "Liberar" na Central cria o cadastro com o perfil Analista (nunca o mais alto).
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'acessos' and table_name = 'aplicativos' and column_name = 'perfil_liberar') then
    execute $q$update acessos.aplicativos set perfil_liberar = 'analista' where schema_name = 'imobenviomassa' and perfil_liberar is null$q$;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 16. Retenção diária no pg_cron (se disponível)
-- ---------------------------------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível (%). Ative em Database > Extensions e agende: select imobenviomassa.wa_retencao_executar();', sqlerrm;
    return;
  end;
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'imobenviomassa_retencao_diaria';
    perform cron.schedule('imobenviomassa_retencao_diaria', '20 3 * * *', 'select imobenviomassa.wa_retencao_executar()');
  end if;
end $$;

notify pgrst, 'reload schema';
