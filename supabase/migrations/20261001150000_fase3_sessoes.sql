-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 3 / M8: revogação de sessões ao trocar a senha
--
--   Quando a própria pessoa troca a senha, as OUTRAS sessões dela (outros navegadores, token
--   roubado) caem na hora; a sessão atual continua. Quando o Super Admin gera uma nova senha para
--   alguém, TODAS as sessões dessa pessoa caem.
--
--   Isso apaga linhas de auth.sessions (os refresh tokens caem em cascata). A conta de login é
--   compartilhada com outros sistemas Calper: as sessões deles também caem — comportamento esperado
--   numa troca de senha. (Desativar usuário continua sem revogar sessão — decisão 1 do plano.)
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

create or replace function public.auth_revogar_sessoes(p_user_id uuid, p_manter_sessao uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from auth.sessions s
   where s.user_id = p_user_id
     and (p_manter_sessao is null or s.id <> p_manter_sessao);
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function public.auth_revogar_sessoes(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auth_revogar_sessoes(uuid, uuid) to service_role;
