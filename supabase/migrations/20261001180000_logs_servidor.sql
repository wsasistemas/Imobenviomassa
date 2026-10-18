-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 4 / N16: logs lidos só pelo servidor
--
-- A tela Administração → Logs lia wa_auditoria direto pela Data API (policy "wa_auditoria: admin,
-- conta liberada"), o que mostrava IP e e-mail completos a qualquer Admin. Agora a leitura passa
-- pela server function listarAuditoria (src/lib/logs.functions.ts), que usa service_role e mascara
-- IP/e-mail para quem não é Super Admin. O navegador deixa de ter acesso à tabela.
--
-- Mantém: RLS ligada (sem policies = nenhuma linha para anon/authenticated) e todos os grants do
-- service_role (auditoria.server.ts grava; wa_retencao_executar apaga). Escrita já era só servidor.
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

drop policy if exists "wa_auditoria: admin, conta liberada" on public.wa_auditoria;
drop policy if exists "Admins visualizam auditoria" on public.wa_auditoria;

revoke select on public.wa_auditoria from authenticated;
revoke all on public.wa_auditoria from anon;

alter table public.wa_auditoria enable row level security;
grant all on public.wa_auditoria to service_role;
