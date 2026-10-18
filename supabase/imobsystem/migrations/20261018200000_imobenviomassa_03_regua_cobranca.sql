-- =====================================================================================================
-- Imobenviomassa — 03: Régua de Cobrança + integrações Zenvia WhatsApp e E-mail
-- Projeto: ikvjaowvpvxojvcfwnct · schema: imobenviomassa
--
-- Base: docs/PRD-regua-cobranca.md e docs/plano-regua-cobranca.md (decisões D1–D10, 18/10/2026).
-- Somente ADITIVA: tabelas novas; funções existentes só ganham `create or replace` mantendo o comportamento
-- anterior (Vault aceita os prefixos novos; provisionamento ganha os perfis e as regras da régua).
--
-- Regras do projeto mantidas:
--   · tenant = imobiliaria_id em toda tabela, RLS por imobenviomassa.tenant_atual();
--   · o navegador lê só o que não é dado pessoal nem segredo; boletos, contatos, tentativas e eventos
--     são lidos e gravados pelo SERVIDOR do app (service_role), que filtra pela imobiliária do usuário;
--   · tokens, API keys e senhas SMTP no Vault (zenvia_*, resend_*, smtp_*), nunca em coluna.
-- =====================================================================================================

do $$
begin
  if to_regclass('imobenviomassa.usuarios') is null then
    raise exception 'Rode antes a 02 (estrutura do imobenviomassa).';
  end if;
  if to_regclass('imobenviomassa.regua_lote') is not null then
    raise exception 'A estrutura da Régua de Cobrança já existe. Esta migração só cria do zero.';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 1. Perfis do PRD (do sistema: valem para todas as imobiliárias; regras na matriz de cada uma)
-- ---------------------------------------------------------------------------------------------------
insert into imobenviomassa.perfis (chave, nome, descricao, ordem, sistema) values
  ('gestor_financeiro',  'Gestor financeiro',    'Régua de Cobrança completa: lotes, disparo extraordinário e painel.', 60, true),
  ('analista_cobranca',  'Analista de cobrança', 'Monta, revisa e aciona lotes da Régua de Cobrança.', 90, true),
  ('auditoria',          'Auditoria',            'Consulta lotes, tentativas e o painel da régua, sem acionar nada.', 110, true)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- 2. Vault: aceita também zenvia_, resend_ e smtp_ (mesma regra, mais prefixos)
-- ---------------------------------------------------------------------------------------------------
create or replace function imobenviomassa.segredo_nome_valido(p_nome text) returns boolean
  language sql immutable set search_path to ''
as $$ select p_nome is not null and p_nome ~ '^(rm|docusign|zenvia|resend|smtp)_[a-z0-9_]{1,60}$' $$;

create or replace function imobenviomassa.wa_segredo_gravar(p_nome text, p_valor text, p_descricao text default null) returns uuid
  language plpgsql security definer set search_path to ''
as $$
declare
  v_id uuid;
begin
  if not imobenviomassa.segredo_nome_valido(p_nome) then
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

create or replace function imobenviomassa.wa_segredo_ler(p_nome text) returns text
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_valor text;
begin
  if not imobenviomassa.segredo_nome_valido(p_nome) then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_valor using 'imobenviomassa_' || p_nome;
  return v_valor;
end $$;

create or replace function imobenviomassa.wa_segredo_existe(p_nome text) returns boolean
  language plpgsql stable security definer set search_path to ''
as $$
declare
  v_existe boolean;
begin
  if not imobenviomassa.segredo_nome_valido(p_nome) then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return false;
  end if;
  execute 'select exists (select 1 from vault.secrets where name = $1)' into v_existe using 'imobenviomassa_' || p_nome;
  return coalesce(v_existe, false);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Integrações: Zenvia WhatsApp e provedor de e-mail
-- ---------------------------------------------------------------------------------------------------
-- Uma conta Zenvia por imobiliária. Token no Vault: zenvia_token_<imob>; chave do webhook: zenvia_webhook_<imob>.
create table imobenviomassa.integracao_zenvia (
  imobiliaria_id  uuid primary key references imobenviomassa.imobiliarias(id) on delete cascade,
  status_conexao  text not null default 'nao_configurado'
                  check (status_conexao in ('nao_configurado', 'conectado', 'erro')),
  teste_resumo    jsonb not null default '{}'::jsonb,   -- { numeros, templates, erro }
  webhook_ids     jsonb not null default '{}'::jsonb,   -- { MESSAGE: id, MESSAGE_STATUS: id }
  testado_em      timestamptz,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text
);
create trigger integracao_zenvia_tocar before update on imobenviomassa.integracao_zenvia
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Números da conta (remetentes). Setor é texto livre (não há cadastro de setores — decisão D3).
create table imobenviomassa.whatsapp_remetente (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  numero         text not null check (numero ~ '^[0-9]{10,15}$'),
  nome           text,
  setor          text check (setor is null or length(setor) <= 60),
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  na_conta       boolean not null default false,          -- aparece como senderId nos templates do token
  padrao_regua   boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (imobiliaria_id, numero),
  unique (id, imobiliaria_id)
);
create unique index whatsapp_remetente_padrao_unico on imobenviomassa.whatsapp_remetente (imobiliaria_id) where padrao_regua;
create trigger whatsapp_remetente_tocar before update on imobenviomassa.whatsapp_remetente
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Templates de WhatsApp lidos da Zenvia (GET /v2/templates). Variáveis com nome ({{nome}}), lista em `variaveis`.
create table imobenviomassa.whatsapp_template (
  id              uuid primary key default gen_random_uuid(),
  imobiliaria_id  uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  zenvia_id       text not null,
  nome            text not null,
  categoria       text,
  idioma          text,
  status          text not null,                      -- APPROVED, PAUSED, REJECTED, WAITING_REVIEW…
  header_tipo     text,                               -- MEDIA_DOCUMENT, MEDIA_IMAGE, TEXT_FIXED…
  corpo           text,
  variaveis       jsonb not null default '[]'::jsonb, -- ["nome", "valor", …]
  sender_id       text,
  sincronizado_em timestamptz not null default now(),
  unique (imobiliaria_id, zenvia_id),
  unique (id, imobiliaria_id)
);

-- Provedor de e-mail ativo (um por imobiliária). Credencial no Vault: resend_apikey_<imob> ou smtp_senha_<imob>;
-- Zenvia E-mail usa o token da Zenvia.
create table imobenviomassa.email_provedor (
  imobiliaria_id      uuid primary key references imobenviomassa.imobiliarias(id) on delete cascade,
  tipo                text not null default 'resend' check (tipo in ('zenvia', 'resend', 'smtp')),
  ativo               boolean not null default false,
  credencial_testada_em timestamptz,
  smtp_host           text,
  smtp_porta          integer check (smtp_porta is null or smtp_porta between 1 and 65535),
  smtp_usuario        text,
  smtp_seguro         boolean not null default true,
  dominio             text check (dominio is null or dominio ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  dominio_id_provedor text,
  status_dominio      text check (status_dominio is null or status_dominio in
                        ('not_started', 'pending', 'verified', 'failed', 'temporary_failure', 'partially_verified', 'partially_failed')),
  registros_dns       jsonb not null default '[]'::jsonb,
  dominio_verificado_em timestamptz,
  remetente_nome      text check (remetente_nome is null or length(remetente_nome) <= 80),
  remetente_email     text,
  reply_to            text,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      text
);
create trigger email_provedor_tocar before update on imobenviomassa.email_provedor
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Eventos crus do webhook da Zenvia (idempotente: a Zenvia pode reenviar o mesmo evento).
create table imobenviomassa.zenvia_eventos (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  tipo           text not null,
  zenvia_id      text,
  status         text,
  payload        jsonb not null,
  recebido_em    timestamptz not null default now()
);
create unique index zenvia_eventos_unico on imobenviomassa.zenvia_eventos (imobiliaria_id, tipo, zenvia_id, coalesce(status, ''));
create index zenvia_eventos_recebido_idx on imobenviomassa.zenvia_eventos (imobiliaria_id, recebido_em desc);

-- ---------------------------------------------------------------------------------------------------
-- 4. Régua de Cobrança
-- ---------------------------------------------------------------------------------------------------
create table imobenviomassa.regua_config (
  imobiliaria_id         uuid primary key references imobenviomassa.imobiliarias(id) on delete cascade,
  regra_senha            text not null default 'cpf_5_primeiros'
                         check (regra_senha in ('cpf_5_primeiros', 'cpf_4_ultimos', 'cpf_6_primeiros')),
  texto_dica             text not null default 'A senha são os 5 primeiros dígitos do seu CPF ou CNPJ.'
                         check (length(texto_dica) between 5 and 200),
  validade_link_horas    integer not null default 72 check (validade_link_horas between 6 and 720),
  intervalo_whatsapp_seg integer not null default 2 check (intervalo_whatsapp_seg between 0 and 60),
  atualizado_em          timestamptz not null default now(),
  atualizado_por         text
);
create trigger regua_config_tocar before update on imobenviomassa.regua_config
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Biblioteca de templates (D10): vários por canal, cada um com a régua sugerida.
create table imobenviomassa.regua_template (
  id                   uuid primary key default gen_random_uuid(),
  imobiliaria_id       uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  nome                 text not null check (length(btrim(nome)) between 2 and 80),
  canal                text not null check (canal in ('whatsapp', 'email')),
  regua_sugerida       text check (regua_sugerida is null or regua_sugerida in ('a_vencer', '30', '60', '90', '90+')),
  ativo                boolean not null default true,
  -- WhatsApp
  whatsapp_template_id uuid,
  remetente_id         uuid,
  mapa_variaveis       jsonb not null default '{}'::jsonb,   -- { "nome": "cliente_nome", … }
  usa_documento        boolean not null default true,
  -- E-mail
  assunto              text check (assunto is null or length(assunto) <= 200),
  corpo                text check (corpo is null or length(corpo) <= 20000),
  anexo_tipo           text not null default 'pdf_link' check (anexo_tipo in ('pdf_link', 'link')),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       text,
  unique (imobiliaria_id, canal, nome),
  unique (id, imobiliaria_id),
  foreign key (whatsapp_template_id, imobiliaria_id)
    references imobenviomassa.whatsapp_template (id, imobiliaria_id) on delete set null (whatsapp_template_id),
  foreign key (remetente_id, imobiliaria_id)
    references imobenviomassa.whatsapp_remetente (id, imobiliaria_id) on delete set null (remetente_id),
  check (canal <> 'email' or (assunto is not null and corpo is not null))
);
create trigger regua_template_tocar before update on imobenviomassa.regua_template
  for each row execute function imobenviomassa.tocar_atualizado_em();

create table imobenviomassa.regua_lote (
  id                   uuid primary key default gen_random_uuid(),
  imobiliaria_id       uuid not null references imobenviomassa.imobiliarias(id) on delete cascade,
  numero               bigint generated always as identity,
  titulo               text not null check (length(btrim(titulo)) between 3 and 140),
  observacao           text check (observacao is null or length(observacao) <= 300),
  origem               text not null check (origem in ('rm', 'planilha')),
  tipo_regua           text not null check (tipo_regua in ('a_vencer', 'atraso')),
  faixa_atraso         text check (faixa_atraso is null or faixa_atraso in ('30', '60', '90', '90+')),
  periodo_vencimento   daterange,
  filtros              jsonb not null default '{}'::jsonb,
  canais               text[] not null check (canais <@ array['whatsapp', 'email']::text[] and cardinality(canais) between 1 and 2),
  template_whatsapp_id uuid,
  template_email_id    uuid,
  usuario_id           uuid not null references auth.users(id) on delete restrict,
  usuario_nome         text,
  tipo                 text not null default 'normal' check (tipo in ('normal', 'extraordinario')),
  justificativa        text check (justificativa is null or length(justificativa) <= 500),
  status               text not null default 'rascunho'
                       check (status in ('rascunho', 'em_processamento', 'concluido', 'concluido_com_falhas', 'cancelado')),
  contadores           jsonb not null default '{}'::jsonb,
  iniciado_em          timestamptz,
  finalizado_em        timestamptz,
  cancelado_em         timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (id, imobiliaria_id),
  check (tipo_regua <> 'atraso' or faixa_atraso is not null),
  check (tipo <> 'extraordinario' or length(btrim(coalesce(justificativa, ''))) >= 10),
  foreign key (template_whatsapp_id, imobiliaria_id)
    references imobenviomassa.regua_template (id, imobiliaria_id) on delete restrict,
  foreign key (template_email_id, imobiliaria_id)
    references imobenviomassa.regua_template (id, imobiliaria_id) on delete restrict
);
create index regua_lote_imob_criado_idx on imobenviomassa.regua_lote (imobiliaria_id, criado_em desc);
create trigger regua_lote_tocar before update on imobenviomassa.regua_lote
  for each row execute function imobenviomassa.tocar_atualizado_em();

create table imobenviomassa.regua_boleto (
  id                    uuid primary key default gen_random_uuid(),
  imobiliaria_id        uuid not null,
  lote_id               uuid not null,
  cliente_codigo        text,
  cliente_nome          text not null,
  cpf_cnpj              text,                                   -- só dígitos; nunca vai ao navegador sem máscara
  empreendimento        text,
  unidade               text,
  numero                text not null,                          -- número do boleto (chave da trava de 24 h)
  vencimento            date,
  dias_atraso           integer,
  valor                 numeric(14, 2),
  linha_digitavel       text,
  status_registro_banco text not null default 'nao_verificado'
                        check (status_registro_banco in ('registrado', 'nao_registrado', 'nao_verificado', 'erro')),
  status_geral          text not null default 'pendente'
                        check (status_geral in ('pendente', 'elegivel', 'excecao_registro', 'excecao_contato', 'excluido',
                                                'processando', 'sucesso', 'parcial', 'falha')),
  incluido              boolean not null default true,         -- o usuário pode excluir a linha na pré-visualização
  dados                 jsonb not null default '{}'::jsonb,    -- colunas extras da origem
  anonimizado_em        timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  unique (id, imobiliaria_id),
  unique (lote_id, numero),
  foreign key (lote_id, imobiliaria_id) references imobenviomassa.regua_lote (id, imobiliaria_id) on delete cascade
);
create index regua_boleto_lote_idx on imobenviomassa.regua_boleto (lote_id);
create index regua_boleto_numero_idx on imobenviomassa.regua_boleto (imobiliaria_id, numero);
create trigger regua_boleto_tocar before update on imobenviomassa.regua_boleto
  for each row execute function imobenviomassa.tocar_atualizado_em();

create table imobenviomassa.regua_contato (
  id               uuid primary key default gen_random_uuid(),
  imobiliaria_id   uuid not null,
  boleto_id        uuid not null,
  canal            text not null check (canal in ('whatsapp', 'email')),
  valor            text,
  status_validacao text not null check (status_validacao in ('valido', 'invalido', 'nao_localizado', 'erro', 'nao_informado')),
  validado_em      timestamptz not null default now(),
  unique (boleto_id, canal),
  foreign key (boleto_id, imobiliaria_id) references imobenviomassa.regua_boleto (id, imobiliaria_id) on delete cascade
);

create table imobenviomassa.regua_documento (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null,
  boleto_id      uuid not null unique,
  storage_path   text not null,
  protegido      boolean not null default true,
  tamanho_bytes  integer,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null,
  removido_em    timestamptz,
  foreign key (boleto_id, imobiliaria_id) references imobenviomassa.regua_boleto (id, imobiliaria_id) on delete cascade
);
create index regua_documento_expira_idx on imobenviomassa.regua_documento (expira_em) where removido_em is null;

-- Uma linha por envio (canal) de cada boleto. Reenvio = nova linha. A trava de 24 h olha esta tabela.
create table imobenviomassa.regua_tentativa (
  id                   uuid primary key default gen_random_uuid(),
  imobiliaria_id       uuid not null,
  lote_id              uuid not null,
  boleto_id            uuid not null,
  canal                text not null check (canal in ('whatsapp', 'email')),
  status               text not null default 'pendente'
                       check (status in ('pendente', 'processando', 'enviado', 'entregue', 'lido', 'falha', 'bloqueado_24h', 'cancelado')),
  mensagem_renderizada text,
  provedor             text,
  id_provedor          text,
  payload              jsonb,                                  -- corpo enviado (sem o PDF nem segredos)
  resposta             jsonb,                                  -- resposta do provedor
  erro                 text,
  tentado_em           timestamptz,
  entregue_em          timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  foreign key (boleto_id, imobiliaria_id) references imobenviomassa.regua_boleto (id, imobiliaria_id) on delete cascade,
  foreign key (lote_id, imobiliaria_id) references imobenviomassa.regua_lote (id, imobiliaria_id) on delete cascade
);
create index regua_tentativa_lote_status_idx on imobenviomassa.regua_tentativa (lote_id, status);
create index regua_tentativa_boleto_idx on imobenviomassa.regua_tentativa (boleto_id);
create unique index regua_tentativa_provedor_idx on imobenviomassa.regua_tentativa (provedor, id_provedor) where id_provedor is not null;
create trigger regua_tentativa_tocar before update on imobenviomassa.regua_tentativa
  for each row execute function imobenviomassa.tocar_atualizado_em();

-- Trava de 24 h (RF-06): o mesmo boleto (número) já saiu por este canal nas últimas 24 h nesta imobiliária?
create function imobenviomassa.regua_enviado_24h(p_imobiliaria uuid, p_numero text, p_canal text, p_ignorar_lote uuid default null)
  returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1
      from imobenviomassa.regua_tentativa t
      join imobenviomassa.regua_boleto b on b.id = t.boleto_id
     where t.imobiliaria_id = p_imobiliaria and b.numero = p_numero and t.canal = p_canal
       and t.status in ('enviado', 'entregue', 'lido')
       and t.tentado_em > now() - interval '24 hours'
       and (p_ignorar_lote is null or t.lote_id <> p_ignorar_lote))
$$;

-- Versão em lote da trava: números de boleto (entre os informados) que já saíram pelo canal nas últimas 24 h.
create function imobenviomassa.regua_numeros_enviados_24h(p_imobiliaria uuid, p_numeros text[], p_canal text)
  returns setof text language sql stable security definer set search_path to ''
as $$
  select distinct b.numero
    from imobenviomassa.regua_tentativa t
    join imobenviomassa.regua_boleto b on b.id = t.boleto_id
   where t.imobiliaria_id = p_imobiliaria and t.canal = p_canal and b.numero = any (p_numeros)
     and t.status in ('enviado', 'entregue', 'lido')
     and t.tentado_em > now() - interval '24 hours'
$$;

-- Pega até p_limite tentativas pendentes do lote e marca como "processando" (sem duas abas pegarem a mesma).
create function imobenviomassa.regua_reservar_tentativas(p_imobiliaria uuid, p_lote uuid, p_limite integer)
  returns setof imobenviomassa.regua_tentativa
  language sql security definer set search_path to ''
as $$
  update imobenviomassa.regua_tentativa t
     set status = 'processando', tentado_em = now()
   where t.id in (select id from imobenviomassa.regua_tentativa
                   where imobiliaria_id = p_imobiliaria and lote_id = p_lote and status = 'pendente'
                   order by boleto_id, canal
                   limit greatest(1, least(p_limite, 50))
                   for update skip locked)
  returning t.*
$$;

-- Tentativas presas em "processando" há mais de 10 min (aba fechada no meio) voltam para a fila.
create function imobenviomassa.regua_liberar_presas(p_imobiliaria uuid, p_lote uuid) returns integer
  language sql security definer set search_path to ''
as $$
  with x as (
    update imobenviomassa.regua_tentativa set status = 'pendente'
     where imobiliaria_id = p_imobiliaria and lote_id = p_lote and status = 'processando'
       and tentado_em < now() - interval '10 minutes'
    returning 1)
  select count(*)::integer from x
$$;

-- Status do boleto a partir das tentativas (chamado pelo servidor depois de cada envio e pelo webhook).
create function imobenviomassa.regua_recalcular_boleto(p_boleto uuid) returns text
  language plpgsql security definer set search_path to ''
as $$
declare
  v_atual text;
  v_ok integer;
  v_falha integer;
  v_aberto integer;
  v_novo text;
begin
  select status_geral into v_atual from imobenviomassa.regua_boleto where id = p_boleto;
  if v_atual is null or v_atual in ('excecao_registro', 'excecao_contato', 'excluido') then
    return v_atual;
  end if;
  -- Por canal vale a tentativa mais recente (um reenvio com sucesso cobre a falha anterior).
  with ultima as (
    select distinct on (canal) canal, status
      from imobenviomassa.regua_tentativa where boleto_id = p_boleto and status <> 'cancelado'
     order by canal, criado_em desc)
  select count(*) filter (where status in ('enviado', 'entregue', 'lido')),
         count(*) filter (where status in ('falha', 'bloqueado_24h')),
         count(*) filter (where status in ('pendente', 'processando'))
    into v_ok, v_falha, v_aberto
    from ultima;
  v_novo := case
    when v_aberto > 0 then 'processando'
    when v_ok > 0 and v_falha = 0 then 'sucesso'
    when v_ok > 0 then 'parcial'
    when v_falha > 0 then 'falha'
    else v_atual end;
  if v_novo is distinct from v_atual then
    update imobenviomassa.regua_boleto set status_geral = v_novo where id = p_boleto;
  end if;
  return v_novo;
end $$;

-- Recalcula todos os boletos do lote (depois de abrir a fila ou cancelar).
create function imobenviomassa.regua_recalcular_lote(p_lote uuid) returns integer
  language plpgsql security definer set search_path to ''
as $$
declare
  v uuid;
  n integer := 0;
begin
  for v in select id from imobenviomassa.regua_boleto
            where lote_id = p_lote and status_geral not in ('excecao_registro', 'excecao_contato', 'excluido') loop
    perform imobenviomassa.regua_recalcular_boleto(v);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Contadores do lote (RF-08) e tempo de processamento.
create function imobenviomassa.regua_contadores(p_lote uuid) returns jsonb
  language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'no_lote',          count(*) filter (where b.status_geral <> 'excluido'),
    'excluidos',        count(*) filter (where b.status_geral = 'excluido'),
    'nao_registrados',  count(*) filter (where b.status_geral = 'excecao_registro'),
    'sem_contato',      count(*) filter (where b.status_geral = 'excecao_contato'),
    'elegiveis',        count(*) filter (where b.status_geral not in ('excluido', 'excecao_registro', 'excecao_contato')),
    'sucesso',          count(*) filter (where b.status_geral in ('sucesso', 'parcial')),
    'parcial',          count(*) filter (where b.status_geral = 'parcial'),
    'falhas',           count(*) filter (where b.status_geral = 'falha'),
    'processando',      count(*) filter (where b.status_geral in ('processando', 'elegivel', 'pendente')),
    'whatsapp',         (select jsonb_build_object(
                           'enviados',  count(*) filter (where t.status in ('enviado', 'entregue', 'lido')),
                           'entregues', count(*) filter (where t.status in ('entregue', 'lido')),
                           'lidos',     count(*) filter (where t.status = 'lido'),
                           'falhas',    count(*) filter (where t.status = 'falha'),
                           'bloqueados', count(*) filter (where t.status = 'bloqueado_24h'),
                           'fila',      count(*) filter (where t.status in ('pendente', 'processando')))
                           from imobenviomassa.regua_tentativa t where t.lote_id = p_lote and t.canal = 'whatsapp'),
    'email',            (select jsonb_build_object(
                           'enviados',  count(*) filter (where t.status in ('enviado', 'entregue', 'lido')),
                           'entregues', count(*) filter (where t.status in ('entregue', 'lido')),
                           'falhas',    count(*) filter (where t.status = 'falha'),
                           'bloqueados', count(*) filter (where t.status = 'bloqueado_24h'),
                           'fila',      count(*) filter (where t.status in ('pendente', 'processando')))
                           from imobenviomassa.regua_tentativa t where t.lote_id = p_lote and t.canal = 'email'))
    from imobenviomassa.regua_boleto b where b.lote_id = p_lote
$$;

-- Painel (RF-01/02): indicadores do período, filtrados por empreendimento, canal, régua e lote.
create function imobenviomassa.regua_painel(
  p_imobiliaria uuid, p_de date, p_ate date, p_empreendimento text default null, p_canal text default null,
  p_regua text default null, p_lote uuid default null, p_status text default null
) returns jsonb
  language sql stable security definer set search_path to ''
as $$
  with lotes as (
    select l.* from imobenviomassa.regua_lote l
     where l.imobiliaria_id = p_imobiliaria and l.status <> 'rascunho'
       and l.iniciado_em >= p_de and l.iniciado_em < p_ate + 1
       and (p_lote is null or l.id = p_lote)
       and (p_status is null or l.status = p_status)
       and (p_regua is null or (p_regua = 'a_vencer' and l.tipo_regua = 'a_vencer') or l.faixa_atraso = p_regua)),
  bols as (
    select b.* from imobenviomassa.regua_boleto b join lotes l on l.id = b.lote_id
     where b.status_geral <> 'excluido' and (p_empreendimento is null or b.empreendimento = p_empreendimento)),
  tents as (
    select t.* from imobenviomassa.regua_tentativa t join bols b on b.id = t.boleto_id
     where (p_canal is null or t.canal = p_canal) and t.status <> 'cancelado')
  select jsonb_build_object(
    'elegiveis',      (select count(*) from bols where status_geral not in ('excecao_registro', 'excecao_contato')),
    'sucesso',        (select count(*) from bols where status_geral in ('sucesso', 'parcial')),
    'boletos',        (select count(*) from bols),
    'invalidos',      (select count(*) from bols where status_geral = 'excecao_contato'),
    'nao_registrados',(select count(*) from bols where status_geral = 'excecao_registro'),
    'falhas',         (select count(*) from bols where status_geral = 'falha'),
    'whatsapp',       (select jsonb_build_object('enviados', count(*) filter (where status in ('enviado','entregue','lido')),
                                                  'entregues', count(*) filter (where status in ('entregue','lido')))
                         from tents where canal = 'whatsapp'),
    'email',          (select jsonb_build_object('enviados', count(*) filter (where status in ('enviado','entregue','lido')),
                                                  'entregues', count(*) filter (where status in ('entregue','lido')))
                         from tents where canal = 'email'),
    'tempo_medio_seg',(select coalesce(round(avg(extract(epoch from (finalizado_em - iniciado_em)))), 0)
                         from lotes where finalizado_em is not null),
    'por_dia',        (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'whatsapp', w, 'email', e) order by dia), '[]'::jsonb)
                         from (select (tentado_em at time zone 'America/Sao_Paulo')::date as dia,
                                      count(*) filter (where canal = 'whatsapp') as w,
                                      count(*) filter (where canal = 'email') as e
                                 from tents where status in ('enviado','entregue','lido') and tentado_em is not null
                                group by 1) x),
    'por_empreendimento', (select coalesce(jsonb_agg(jsonb_build_object('empreendimento', emp, 'boletos', n, 'sucesso', s) order by n desc), '[]'::jsonb)
                         from (select coalesce(nullif(empreendimento, ''), '(sem empreendimento)') as emp, count(*) as n,
                                      count(*) filter (where status_geral in ('sucesso', 'parcial')) as s
                                 from bols group by 1 limit 20) y),
    'empreendimentos', (select coalesce(jsonb_agg(distinct b.empreendimento), '[]'::jsonb)
                          from imobenviomassa.regua_boleto b where b.imobiliaria_id = p_imobiliaria and b.empreendimento is not null)
  )
$$;

-- ---------------------------------------------------------------------------------------------------
-- 5. Provisionamento: linhas padrão + regras dos perfis (mantém o que a 02 fazia)
-- ---------------------------------------------------------------------------------------------------
create or replace function imobenviomassa.provisionar_imobiliaria(p_imobiliaria uuid) returns void
  language plpgsql security definer set search_path to ''
as $$
begin
  insert into imobenviomassa.wa_retencao_config (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.integracao_rm (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.integracao_rm_recurso (imobiliaria_id, recurso)
  values (p_imobiliaria, 'empreendimentos'), (p_imobiliaria, 'compradores') on conflict do nothing;
  insert into imobenviomassa.integracao_zenvia (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.email_provedor (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  insert into imobenviomassa.regua_config (imobiliaria_id) values (p_imobiliaria) on conflict do nothing;
  -- Liberações iniciais (espelho: REGRAS_DO_NIVEL em src/lib/permissoes.ts e docs/plano-regua-cobranca.md §3).
  insert into imobenviomassa.perfil_permissoes (imobiliaria_id, perfil, permission_id, enabled)
  select p_imobiliaria, r.perfil, r.permission_id, true
    from (values
      ('admin', 'disparos'), ('admin', 'docusign'), ('admin', 'ver_dashboard'), ('admin', 'criar_disparo'),
      ('admin', 'ver_historico'), ('admin', 'ver_relatorios'), ('admin', 'gateway_apis'),
      ('admin', 'view_audit_logs'), ('admin', 'manage_privacy'),
      ('admin', 'regua_cobranca'), ('admin', 'regua_dashboard_ver'), ('admin', 'regua_lote_criar'),
      ('admin', 'regua_lote_acionar'), ('admin', 'regua_disparo_extraordinario'), ('admin', 'regua_auditoria_ver'),
      ('admin', 'regua_templates'), ('admin', 'regua_config_editar'),
      ('analista', 'disparos'), ('analista', 'docusign'), ('analista', 'ver_dashboard'),
      ('analista', 'criar_disparo'), ('analista', 'ver_historico'), ('analista', 'ver_relatorios'),
      ('gestor_financeiro', 'disparos'), ('gestor_financeiro', 'regua_cobranca'), ('gestor_financeiro', 'regua_dashboard_ver'),
      ('gestor_financeiro', 'regua_lote_criar'), ('gestor_financeiro', 'regua_lote_acionar'),
      ('gestor_financeiro', 'regua_disparo_extraordinario'), ('gestor_financeiro', 'regua_auditoria_ver'),
      ('analista_cobranca', 'disparos'), ('analista_cobranca', 'regua_cobranca'), ('analista_cobranca', 'regua_lote_criar'),
      ('analista_cobranca', 'regua_lote_acionar'), ('analista_cobranca', 'regua_auditoria_ver'),
      ('auditoria', 'disparos'), ('auditoria', 'regua_cobranca'), ('auditoria', 'regua_dashboard_ver'),
      ('auditoria', 'regua_auditoria_ver')
    ) as r(perfil, permission_id)
  on conflict do nothing;
end $$;

-- Imobiliárias que já existem recebem as linhas e regras novas (idempotente).
do $$
declare v uuid;
begin
  for v in select id from imobenviomassa.imobiliarias loop
    perform imobenviomassa.provisionar_imobiliaria(v);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. Storage: bucket privado dos boletos (PDF protegido; acesso só por URL assinada)
-- ---------------------------------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('imobenviomassa-regua', 'imobenviomassa-regua', false, 5242880, array['application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. RLS e privilégios (tudo fechado; o navegador lê só tabelas sem dado pessoal nem segredo)
-- ---------------------------------------------------------------------------------------------------
alter table imobenviomassa.integracao_zenvia  enable row level security;
alter table imobenviomassa.whatsapp_remetente enable row level security;
alter table imobenviomassa.whatsapp_template  enable row level security;
alter table imobenviomassa.email_provedor     enable row level security;
alter table imobenviomassa.zenvia_eventos     enable row level security;
alter table imobenviomassa.regua_config       enable row level security;
alter table imobenviomassa.regua_template     enable row level security;
alter table imobenviomassa.regua_lote         enable row level security;
alter table imobenviomassa.regua_boleto       enable row level security;
alter table imobenviomassa.regua_contato      enable row level security;
alter table imobenviomassa.regua_documento    enable row level security;
alter table imobenviomassa.regua_tentativa    enable row level security;

-- Lotes: quem tem alguma permissão da régua na imobiliária.
create policy regua_ler on imobenviomassa.regua_lote for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and ((select imobenviomassa.tem_permissao('regua_auditoria_ver'))
              or (select imobenviomassa.tem_permissao('regua_lote_criar'))
              or (select imobenviomassa.tem_permissao('regua_dashboard_ver'))));

create policy regua_ler on imobenviomassa.regua_template for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and (select imobenviomassa.tem_permissao('regua_cobranca')));

create policy regua_ler on imobenviomassa.regua_config for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and (select imobenviomassa.tem_permissao('regua_cobranca')));

create policy regua_ler on imobenviomassa.whatsapp_template for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and ((select imobenviomassa.tem_permissao('regua_cobranca')) or (select imobenviomassa.sou_admin())));

create policy regua_ler on imobenviomassa.whatsapp_remetente for select to authenticated
  using (imobiliaria_id = (select imobenviomassa.tenant_atual())
         and (select imobenviomassa.conta_liberada())
         and ((select imobenviomassa.tem_permissao('regua_cobranca')) or (select imobenviomassa.sou_admin())));

revoke all on imobenviomassa.integracao_zenvia, imobenviomassa.whatsapp_remetente, imobenviomassa.whatsapp_template,
  imobenviomassa.email_provedor, imobenviomassa.zenvia_eventos, imobenviomassa.regua_config, imobenviomassa.regua_template,
  imobenviomassa.regua_lote, imobenviomassa.regua_boleto, imobenviomassa.regua_contato, imobenviomassa.regua_documento,
  imobenviomassa.regua_tentativa
  from public, anon, authenticated;
grant all on imobenviomassa.integracao_zenvia, imobenviomassa.whatsapp_remetente, imobenviomassa.whatsapp_template,
  imobenviomassa.email_provedor, imobenviomassa.zenvia_eventos, imobenviomassa.regua_config, imobenviomassa.regua_template,
  imobenviomassa.regua_lote, imobenviomassa.regua_boleto, imobenviomassa.regua_contato, imobenviomassa.regua_documento,
  imobenviomassa.regua_tentativa
  to service_role;
grant usage, select on all sequences in schema imobenviomassa to service_role;

grant select on imobenviomassa.regua_lote, imobenviomassa.regua_template, imobenviomassa.regua_config,
  imobenviomassa.whatsapp_template, imobenviomassa.whatsapp_remetente to authenticated;

revoke execute on function imobenviomassa.segredo_nome_valido(text), imobenviomassa.regua_enviado_24h(uuid, text, text, uuid),
  imobenviomassa.regua_reservar_tentativas(uuid, uuid, integer), imobenviomassa.regua_liberar_presas(uuid, uuid),
  imobenviomassa.regua_recalcular_boleto(uuid), imobenviomassa.regua_contadores(uuid),
  imobenviomassa.regua_painel(uuid, date, date, text, text, text, uuid, text),
  imobenviomassa.regua_numeros_enviados_24h(uuid, text[], text), imobenviomassa.regua_recalcular_lote(uuid)
  from public, anon, authenticated;
grant execute on function imobenviomassa.segredo_nome_valido(text), imobenviomassa.regua_enviado_24h(uuid, text, text, uuid),
  imobenviomassa.regua_reservar_tentativas(uuid, uuid, integer), imobenviomassa.regua_liberar_presas(uuid, uuid),
  imobenviomassa.regua_recalcular_boleto(uuid), imobenviomassa.regua_contadores(uuid),
  imobenviomassa.regua_painel(uuid, date, date, text, text, text, uuid, text),
  imobenviomassa.regua_numeros_enviados_24h(uuid, text[], text), imobenviomassa.regua_recalcular_lote(uuid)
  to service_role;
-- As funções do Vault recriadas mantêm os privilégios anteriores (só service_role); reforço:
revoke execute on function imobenviomassa.wa_segredo_gravar(text, text, text), imobenviomassa.wa_segredo_ler(text),
  imobenviomassa.wa_segredo_existe(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
