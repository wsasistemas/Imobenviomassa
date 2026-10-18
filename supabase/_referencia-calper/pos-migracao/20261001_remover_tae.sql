-- =====================================================================
-- Remove a integração TAE (TOTVS Assinatura Eletrônica) do banco.
--
-- O portal deixou de usar o TAE em 2026-10-01: o código, as telas e as server functions foram
-- removidos do repositório. Estas tabelas foram criadas fora do repositório (projeto Supabase
-- compartilhado) e guardam senhas de serviço em texto claro — por isso vale apagá-las.
--
-- NÃO roda sozinho. Execute no SQL Editor só DEPOIS de:
--   1. confirmar que nenhum outro sistema Calper usa estas tabelas:
--        select schemaname, tablename from pg_tables
--         where tablename in ('tae_integration_settings','tae_webhook_subscriptions',
--                             'campanha_assinaturas','campanha_assinatura_logs');
--        -- e, no dashboard, Database → Advisors / Logs: nenhuma consulta recente a elas;
--   2. publicar o app atualizado (sem o módulo TAE).
--
-- A migração 20261001110000_tae_segredos_privados.sql continua no repositório (é condicional:
-- não falha se as tabelas não existirem).
-- =====================================================================

drop table if exists public.tae_webhook_subscriptions cascade;
drop table if exists public.tae_integration_settings cascade;
drop table if exists public.campanha_assinatura_logs cascade;
drop table if exists public.campanha_assinaturas cascade;
