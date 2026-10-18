-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 0: limpeza de tabelas legadas
--
--   1. public.totvs_config: credenciais do RM em texto claro, legíveis por Admin pela Data API.
--      Já foram copiadas para envio_privado.integracao_rm (migração 20260929120000); o script
--      manual supabase/pos-migracao/20260929_remover_totvs_config.sql apagava a tabela — agora é
--      feito aqui, de forma versionada.
--   2. public.wa_integracoes_config: tabela chave/valor sem uso no código (conferido em 2026-10-01:
--      só account_id / integration_key / user_id do DocuSign, private_key vazia). Removida.
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

drop table if exists public.totvs_config;
drop table if exists public.wa_integracoes_config;
