-- =====================================================================
-- TAE (TOTVS Assinatura Eletrônica) — credenciais fora da Data API
--
--   tae_integration_settings guarda a senha do usuário de serviço, a senha do remetente e o webhook
--   secret; tae_webhook_subscriptions guarda headers customizados (que podem carregar tokens). As duas
--   tabelas foram criadas fora deste repositório, com policies desconhecidas, e o app lia tudo com o
--   JWT do usuário (select "*") — a senha chegava ao navegador de qualquer Admin.
--
--   A partir daqui vale o mesmo modelo de docusign_config / envio_privado (migrações 20260930100000 e
--   20260929120000): nenhuma policy, nenhum grant para anon/authenticated; só o servidor lê e grava,
--   com a service_role (src/lib/tae-config.functions.ts, tae-webhooks.functions.ts, tae-sync.server.ts).
--   O papel do usuário é conferido na server function (leitura: Admin/Super Admin; alteração de
--   credenciais: só Super Admin).
--
-- Idempotente: pode ser rodado de novo; não falha em projeto onde a tabela ainda não existe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. tae_integration_settings: só service_role
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.tae_integration_settings') is null then
    raise notice 'tae_integration_settings não existe neste projeto; nada a fazer.';
    return;
  end if;

  -- remove qualquer policy criada fora do repositório
  for p in
    select policyname
      from pg_policies
     where schemaname = 'public' and tablename = 'tae_integration_settings'
  loop
    execute format('drop policy %I on public.tae_integration_settings', p.policyname);
  end loop;

  execute 'revoke all on public.tae_integration_settings from public, anon, authenticated';
  execute 'grant all on public.tae_integration_settings to service_role';
  -- sem policies: só service_role
  execute 'alter table public.tae_integration_settings enable row level security';
end
$$;

-- ---------------------------------------------------------------------
-- 2. tae_webhook_subscriptions: só service_role
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.tae_webhook_subscriptions') is null then
    raise notice 'tae_webhook_subscriptions não existe neste projeto; nada a fazer.';
    return;
  end if;

  for p in
    select policyname
      from pg_policies
     where schemaname = 'public' and tablename = 'tae_webhook_subscriptions'
  loop
    execute format('drop policy %I on public.tae_webhook_subscriptions', p.policyname);
  end loop;

  execute 'revoke all on public.tae_webhook_subscriptions from public, anon, authenticated';
  execute 'grant all on public.tae_webhook_subscriptions to service_role';
  -- sem policies: só service_role
  execute 'alter table public.tae_webhook_subscriptions enable row level security';
end
$$;
