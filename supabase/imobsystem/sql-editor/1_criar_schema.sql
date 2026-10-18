-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Tudo numa transação: se der erro, nada fica pela metade.
-- Conteúdo idêntico a migrations/20261017233000_imobenviomassa_schema.sql.
begin;

-- =====================================================================================================
-- Imobenviomassa (Disparo em Massa) — schema próprio no Supabase ImobSystem (ikvjaowvpvxojvcfwnct)
-- Pedido de 17/10/2026: criar o schema vazio. As tabelas entram em migrations seguintes.
--
-- Aditiva e idempotente: pode rodar de novo sem efeito. Não altera nenhum outro schema.
-- O projeto é compartilhado (ImobSystem, Imobsuprimentos, ImobDoces): a lista de schemas expostos
-- na API é ACRESCENTADA, nunca regravada (ver Cerebro: supabase-pgrst-db-schemas-no-banco-anula-painel).
-- =====================================================================================================

create schema if not exists imobenviomassa;

comment on schema imobenviomassa is
  'Imobenviomassa (Disparo em Massa — WSA Sistemas). Envio de documentos DocuSign e régua de cobrança.';

-- Ordem segura: fechar o anon ANTES de expor o schema na API.
revoke all on schema imobenviomassa from public;
revoke all on schema imobenviomassa from anon;

grant usage on schema imobenviomassa to authenticated, service_role;

-- Privilégios padrão dos objetos que as próximas migrations criarem (feitas pelo papel postgres).
-- Toda tabela nova terá RLS ligado na própria migration; o grant ao authenticated só vale junto com as policies.
alter default privileges for role postgres in schema imobenviomassa revoke all on tables from public, anon;
alter default privileges for role postgres in schema imobenviomassa revoke all on sequences from public, anon;
alter default privileges for role postgres in schema imobenviomassa revoke execute on functions from public, anon;

alter default privileges for role postgres in schema imobenviomassa
  grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema imobenviomassa
  grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema imobenviomassa
  grant execute on functions to authenticated;

alter default privileges for role postgres in schema imobenviomassa grant all on tables to service_role;
alter default privileges for role postgres in schema imobenviomassa grant all on sequences to service_role;
alter default privileges for role postgres in schema imobenviomassa grant all on functions to service_role;

-- Expor na Data API: acrescenta o schema à lista que o PostgREST usa de fato (pgrst.db_schemas do authenticator).
-- Se o banco não tiver lista própria, parte da lista padrão do Supabase (public, graphql_public).
do $$
declare
  v_atual text;
begin
  select split_part(c, '=', 2) into v_atual
  from pg_roles r, unnest(r.rolconfig) c
  where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';

  v_atual := coalesce(nullif(btrim(v_atual), ''), 'public, graphql_public');

  if not ('imobenviomassa' = any (string_to_array(replace(v_atual, ' ', ''), ','))) then
    execute format('alter role authenticator set pgrst.db_schemas = %L', v_atual || ', imobenviomassa');
  end if;
end $$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;
