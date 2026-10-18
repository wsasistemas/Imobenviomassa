-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 1 / C4: limite de tentativas de login
--
-- Requisito: no máximo 5 tentativas por IP E por conta, contagem de tentativas, bloqueio temporário,
-- desbloqueio pelo Super Admin — sem captcha. Defesa em três camadas:
--
--   1. Server function `login` (src/lib/auth.functions.ts): antes de autenticar consulta
--      auth_pre_login(e-mail, ip); depois registra o resultado em auth_registrar_resultado, que conta
--      falhas por conta (chave 'conta:<email>') e por IP (chave 'ip:<ip>') e bloqueia com backoff
--      exponencial (15 min, 30 min, 1 h … até 24 h). Também grava auth_login_log (quem, de onde,
--      resultado).
--   2. Auth Hook "Password Verification Attempt" (hook_verificacao_senha): roda DENTRO do Supabase
--      Auth a cada verificação de senha, inclusive se alguém chamar o GoTrue direto com a chave
--      pública, pulando a server function. Bloqueia POR CONTA (user_id) após 5 falhas em 15 min.
--      >>> Precisa ser ATIVADO no dashboard: Authentication → Hooks → Password Verification Attempt
--      >>> → Postgres → schema public, função hook_verificacao_senha.
--   3. Rate limit por IP do próprio GoTrue (Authentication → Rate Limits) como pano de fundo.
--
-- Nenhuma destas tabelas/funções é acessível pela Data API: tudo é service_role (e o hook, pelo
-- papel supabase_auth_admin).
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.auth_tentativas (
  chave              text primary key,                -- 'conta:<email>' | 'ip:<ip>'
  falhas             integer not null default 0,
  primeira_falha_em  timestamptz,
  ultima_falha_em    timestamptz,
  bloqueado_ate      timestamptz,
  bloqueios          integer not null default 0       -- quantas vezes já bloqueou (backoff)
);

create table if not exists public.auth_login_log (
  id          bigserial primary key,
  email_norm  text,
  user_id     uuid,
  ip          text,
  user_agent  text,
  origem      text not null default 'login',          -- 'login' | 'troca_senha'
  resultado   text not null,                          -- ok | credencial_invalida | bloqueado | conta_inativa
  created_at  timestamptz not null default now()
);
create index if not exists auth_login_log_created_idx on public.auth_login_log (created_at desc);
create index if not exists auth_login_log_email_idx on public.auth_login_log (email_norm, created_at desc);

-- Lida pelo hook do GoTrue: o hook só recebe user_id e se a senha conferiu.
create table if not exists public.auth_falhas_por_usuario (
  user_id          uuid primary key,
  falhas           integer not null default 0,
  ultima_falha_em  timestamptz,
  bloqueado_ate    timestamptz
);

alter table public.auth_tentativas enable row level security;
alter table public.auth_login_log enable row level security;
alter table public.auth_falhas_por_usuario enable row level security;

revoke all on public.auth_tentativas, public.auth_login_log, public.auth_falhas_por_usuario
  from public, anon, authenticated;
revoke all on sequence public.auth_login_log_id_seq from public, anon, authenticated;
grant all on public.auth_tentativas, public.auth_login_log, public.auth_falhas_por_usuario to service_role;
grant all on sequence public.auth_login_log_id_seq to service_role;
grant usage on schema public to supabase_auth_admin;
grant all on public.auth_falhas_por_usuario to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 2. Parâmetros (uma linha só; ajuste aqui, sem redeploy)
-- ---------------------------------------------------------------------
create table if not exists public.auth_bloqueio_config (
  id                 boolean primary key default true check (id),
  max_falhas         integer not null default 5,
  janela_minutos     integer not null default 15,
  bloqueio_minutos   integer not null default 15,     -- base do backoff: 15, 30, 60 … min
  bloqueio_max_horas integer not null default 24
);
insert into public.auth_bloqueio_config (id) values (true) on conflict (id) do nothing;
alter table public.auth_bloqueio_config enable row level security;
revoke all on public.auth_bloqueio_config from public, anon, authenticated;
grant select on public.auth_bloqueio_config to service_role, supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 3. Funções (SECURITY DEFINER, search_path fixo, EXECUTE só service_role)
-- ---------------------------------------------------------------------

-- Antes de autenticar: a conta ou o IP estão bloqueados? Resposta igual nos dois casos, para não
-- revelar se o e-mail existe.
create or replace function public.auth_pre_login(p_email text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ate timestamptz;
begin
  select max(t.bloqueado_ate) into v_ate
    from public.auth_tentativas t
   where t.chave in ('conta:' || lower(coalesce(p_email, '')), 'ip:' || coalesce(p_ip, ''))
     and t.bloqueado_ate > now();
  if v_ate is not null then
    return jsonb_build_object('permitido', false, 'ate', v_ate);
  end if;
  return jsonb_build_object('permitido', true);
end
$$;

-- Depois de autenticar: registra o resultado, conta falhas por conta e por IP, bloqueia.
-- Conta também e-mails inexistentes (a chave é o texto do e-mail) — sem enumeração.
create or replace function public.auth_registrar_resultado(
  p_email text,
  p_ip text,
  p_ok boolean,
  p_user_id uuid default null,
  p_ua text default null,
  p_origem text default 'login',
  p_resultado text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
  k text;
  v_bloqueado boolean := false;
  v_ate timestamptz;
  v_email text := lower(coalesce(p_email, ''));
begin
  select * into cfg from public.auth_bloqueio_config where id limit 1;

  insert into public.auth_login_log (email_norm, user_id, ip, user_agent, origem, resultado)
  values (
    v_email, p_user_id, p_ip, left(p_ua, 300), coalesce(p_origem, 'login'),
    coalesce(p_resultado, case when p_ok then 'ok' else 'credencial_invalida' end)
  );

  if p_ok then
    delete from public.auth_tentativas where chave in ('conta:' || v_email, 'ip:' || coalesce(p_ip, ''));
    if p_user_id is not null then
      delete from public.auth_falhas_por_usuario where user_id = p_user_id;
    end if;
    return jsonb_build_object('bloqueado', false);
  end if;

  foreach k in array array['conta:' || v_email, 'ip:' || coalesce(p_ip, '')] loop
    insert into public.auth_tentativas (chave, falhas, primeira_falha_em, ultima_falha_em)
    values (k, 1, now(), now())
    on conflict (chave) do update set
      falhas = case
        when public.auth_tentativas.primeira_falha_em is null
          or public.auth_tentativas.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
        then 1 else public.auth_tentativas.falhas + 1 end,
      primeira_falha_em = case
        when public.auth_tentativas.primeira_falha_em is null
          or public.auth_tentativas.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
        then now() else public.auth_tentativas.primeira_falha_em end,
      ultima_falha_em = now();

    update public.auth_tentativas t
       set bloqueios = t.bloqueios + 1,
           bloqueado_ate = now() + least(
             make_interval(mins => cfg.bloqueio_minutos) * power(2, t.bloqueios),
             make_interval(hours => cfg.bloqueio_max_horas)),
           falhas = 0,
           primeira_falha_em = null
     where t.chave = k and t.falhas >= cfg.max_falhas
     returning t.bloqueado_ate into v_ate;
    if v_ate is not null then v_bloqueado := true; end if;
  end loop;

  return jsonb_build_object('bloqueado', v_bloqueado, 'ate', v_ate);
end
$$;

-- Desbloqueio pelo Super Admin (tela Usuários): limpa as três tabelas para a conta.
create or replace function public.auth_desbloquear(p_email text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.auth_tentativas where chave = 'conta:' || lower(coalesce(p_email, ''));
  if p_user_id is not null then
    delete from public.auth_falhas_por_usuario where user_id = p_user_id;
  end if;
end
$$;

-- Situação de bloqueio de um usuário (para a tela Usuários): maior "bloqueado_ate" futuro.
create or replace function public.auth_bloqueio_de(p_email text, p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    (select t.bloqueado_ate from public.auth_tentativas t
      where t.chave = 'conta:' || lower(coalesce(p_email, '')) and t.bloqueado_ate > now()),
    (select f.bloqueado_ate from public.auth_falhas_por_usuario f
      where f.user_id = p_user_id and f.bloqueado_ate > now())
  );
$$;

revoke all on function public.auth_pre_login(text, text) from public, anon, authenticated;
revoke all on function public.auth_registrar_resultado(text, text, boolean, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.auth_desbloquear(text, uuid) from public, anon, authenticated;
revoke all on function public.auth_bloqueio_de(text, uuid) from public, anon, authenticated;
grant execute on function public.auth_pre_login(text, text) to service_role;
grant execute on function public.auth_registrar_resultado(text, text, boolean, uuid, text, text, text) to service_role;
grant execute on function public.auth_desbloquear(text, uuid) to service_role;
grant execute on function public.auth_bloqueio_de(text, uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. Auth Hook: Password Verification Attempt (bloqueio por conta dentro do GoTrue)
--    Entrada: { "user_id": uuid, "valid": bool }
--    Saída:   { "decision": "continue" } | { "error": { "http_code": 429, "message": "…" } }
-- ---------------------------------------------------------------------
create or replace function public.hook_verificacao_senha(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
  v_uid uuid := (event->>'user_id')::uuid;
  v_valid boolean := coalesce((event->>'valid')::boolean, false);
  f record;
begin
  select * into cfg from public.auth_bloqueio_config where id limit 1;

  select * into f from public.auth_falhas_por_usuario where user_id = v_uid for update;

  if f.bloqueado_ate is not null and f.bloqueado_ate > now() then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Muitas tentativas. Tente novamente em alguns minutos.'));
  end if;

  if v_valid then
    delete from public.auth_falhas_por_usuario where user_id = v_uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  insert into public.auth_falhas_por_usuario (user_id, falhas, ultima_falha_em)
  values (v_uid, 1, now())
  on conflict (user_id) do update set
    falhas = case
      when public.auth_falhas_por_usuario.ultima_falha_em < now() - make_interval(mins => cfg.janela_minutos)
      then 1 else public.auth_falhas_por_usuario.falhas + 1 end,
    ultima_falha_em = now(),
    bloqueado_ate = null;

  update public.auth_falhas_por_usuario
     set bloqueado_ate = now() + make_interval(mins => cfg.bloqueio_minutos), falhas = 0
   where user_id = v_uid and falhas >= cfg.max_falhas;

  -- Senha errada: o GoTrue já devolve "Invalid login credentials"; só registramos.
  return jsonb_build_object('decision', 'continue');
end
$$;

revoke all on function public.hook_verificacao_senha(jsonb) from public, anon, authenticated;
grant execute on function public.hook_verificacao_senha(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 5. Auditoria: coluna user_agent (o helper src/lib/auditoria.server.ts preenche ip e user_agent)
-- ---------------------------------------------------------------------
alter table public.wa_auditoria add column if not exists user_agent text;
