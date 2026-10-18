-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 1 / C3 e A7: logs e auditoria
--
--   1. wa_auditoria: o navegador não insere mais. Qualquer JWT podia gravar ação, entidade e nome
--      de usuário arbitrários (só o usuario_id era fixado) — trilha forjável. Agora toda auditoria
--      nasce no servidor (src/lib/auditoria.server.ts, service_role), com IP e user agent.
--   2. gateway_call_log: tabela de log do gateway SOAP (projeto compartilhado, sem migração aqui).
--      Guardava envelope SOAP e 4.000 caracteres da resposta do RM (dados de compradores). Sai da
--      Data API: só service_role. O proxy passou a gravar só metadados.
--   3. Retenção: função wa_retencao_executar() apaga logs antigos; agendada no pg_cron (se a
--      extensão estiver disponível — no Supabase: Database → Extensions → pg_cron). Prazos:
--        · gateway_call_log .......... 30 dias
--        · auth_login_log ............ 180 dias
--        · auth_tentativas / falhas .. 1 dia depois do último bloqueio
--        · wa_auditoria .............. 2 anos
--      (Dados de compradores — wa_campanha_destinatarios — ficam para a Fase 4, com prazo a
--       confirmar com o jurídico.)
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. wa_auditoria: escrita só pelo servidor
-- ---------------------------------------------------------------------
drop policy if exists "Usuários autenticados registram auditoria" on public.wa_auditoria;
revoke insert, update, delete on public.wa_auditoria from authenticated, anon;
grant select on public.wa_auditoria to authenticated;     -- leitura continua só para admin (policy)
grant all on public.wa_auditoria to service_role;

-- ---------------------------------------------------------------------
-- 2. gateway_call_log: fora da Data API
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.gateway_call_log') is null then
    return;
  end if;
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'gateway_call_log'
  loop
    execute format('drop policy %I on public.gateway_call_log', p.policyname);
  end loop;
  execute 'revoke all on public.gateway_call_log from public, anon, authenticated';
  execute 'grant all on public.gateway_call_log to service_role';
  execute 'alter table public.gateway_call_log enable row level security';
  execute 'create index if not exists gateway_call_log_created_idx on public.gateway_call_log (created_at)';
end
$$;

-- ---------------------------------------------------------------------
-- 3. Retenção
-- ---------------------------------------------------------------------
create or replace function public.wa_retencao_executar()
returns table (tabela text, apagados bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
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
end
$$;

revoke all on function public.wa_retencao_executar() from public, anon, authenticated;
grant execute on function public.wa_retencao_executar() to service_role;

-- Agenda diária (03:15 UTC) se o pg_cron estiver disponível. Sem a extensão, a função pode ser
-- chamada à mão no SQL Editor: select * from public.wa_retencao_executar();
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível (%). Ative em Database → Extensions e rode esta migração de novo.', sqlerrm;
    return;
  end;
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'wa_retencao_diaria';
    perform cron.schedule('wa_retencao_diaria', '15 3 * * *', 'select public.wa_retencao_executar()');
  end if;
end
$$;
