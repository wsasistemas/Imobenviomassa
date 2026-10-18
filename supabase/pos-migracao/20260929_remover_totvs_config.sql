-- =====================================================================
-- Remove a tabela antiga de credenciais do TOTVS RM (public.totvs_config).
--
-- NÃO roda sozinho: execute no SQL Editor só DEPOIS de
--   1. rodar supabase/migrations/20260929120000_rm_credenciais_privado.sql;
--   2. publicar o app e as Edge Functions atualizados (api-proxy, totvs-soap-proxy);
--   3. conferir em Configurações → Integrações TOTVS RM que os endpoints e o usuário aparecem
--      e que "Testar conexão" funciona.
--
-- Depois disso a senha do RM passa a existir só em envio_privado.integracao_rm.
-- =====================================================================

drop table if exists public.totvs_config;
