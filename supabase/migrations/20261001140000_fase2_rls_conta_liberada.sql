-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 2: RLS fechada, escrita só pelo servidor, login atômico
--
--   1. wa_conta_liberada(): conta ativa no portal e sem troca de senha pendente. Entra em TODAS as
--      policies de dados (wa_campanhas, wa_campanha_destinatarios, wa_auditoria, docusign_envelopes,
--      api_registry). Antes, bastava um JWT "authenticated" do projeto compartilhado (conta
--      desativada, troca pendente ou usuário de outro sistema Calper) para ler/escrever via Data API.
--   2. wa_campanhas / wa_campanha_destinatarios / docusign_envelopes / api_registry: o navegador
--      deixa de inserir, alterar e apagar. Tudo passa pelas server functions (service_role), que
--      validam com zod, aplicam cota, allowlist de dados_extras e conferem o dono. Sem isso, um
--      token de operadora gravava qualquer coisa pelo PostgREST e plantava envelope_docusign_id de
--      outra campanha para ler CPF/telefone alheios (achado N1/N1b).
--   3. api_registry: leitura só Admin/Super Admin (guarda hosts internos, nomes de secrets e
--      templates SOAP); cadastro/remoção via server function.
--   4. Limite de login (N6): pré-checagem e contagem na MESMA função (atômico — uma rajada paralela
--      não testa mais de 5 senhas); IP "desconhecido" não conta; limite por IP separado do limite
--      por conta (20 falhas / 15 min, bloqueio fixo — atrás de NAT corporativo o limite por IP não
--      pode derrubar o escritório inteiro); hook do GoTrue com a mesma janela e backoff; defaults
--      no código caso auth_bloqueio_config fique sem linha (antes: NULL ⇒ nunca bloqueava).
--   5. wa_project_users_guard: allowlist (só service_role ou sessão sem JWT) em vez de denylist.
--   6. user_roles (tabela do projeto compartilhado, sem migração aqui): trigger que impede um JWT
--      de usuário conceder a si mesmo papel diferente de 'cliente' — vale para qualquer portal.
--   7. FKs com ON DELETE, índice em wa_campanhas(criado_por).
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. wa_conta_liberada()
-- ---------------------------------------------------------------------
create or replace function public.wa_conta_liberada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.wa_project_users m
     where m.user_id = auth.uid()
       and m.ativo = true
       and coalesce(m.trocar_senha, false) = false
  );
$$;
revoke all on function public.wa_conta_liberada() from public, anon;
grant execute on function public.wa_conta_liberada() to authenticated, service_role;

-- Atalho usado nas policies: Admin ou Super Admin deste portal.
create or replace function public.wa_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.has_role(auth.uid(), 'super_admin'::public.app_role);
$$;
revoke all on function public.wa_eh_admin() from public, anon;
grant execute on function public.wa_eh_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. wa_campanhas e wa_campanha_destinatarios: leitura com conta liberada; escrita só servidor
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename in ('wa_campanhas', 'wa_campanha_destinatarios')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

revoke insert, update, delete on public.wa_campanhas, public.wa_campanha_destinatarios from authenticated, anon;
grant select on public.wa_campanhas, public.wa_campanha_destinatarios to authenticated;
grant all on public.wa_campanhas, public.wa_campanha_destinatarios to service_role;

create policy "wa_campanhas: criador ou admin, conta liberada"
  on public.wa_campanhas for select to authenticated
  using (public.wa_conta_liberada() and (criado_por = auth.uid() or public.wa_eh_admin()));

create policy "wa_destinatarios: campanha acessível, conta liberada"
  on public.wa_campanha_destinatarios for select to authenticated
  using (
    public.wa_conta_liberada()
    and exists (
      select 1 from public.wa_campanhas c
       where c.id = campanha_id and (c.criado_por = auth.uid() or public.wa_eh_admin())
    )
  );

create index if not exists idx_wa_campanhas_criado_por on public.wa_campanhas (criado_por, created_at desc);
create index if not exists idx_wa_destinatarios_envelope on public.wa_campanha_destinatarios (envelope_docusign_id)
  where envelope_docusign_id is not null;

-- ---------------------------------------------------------------------
-- 3. wa_auditoria: leitura só admin com conta liberada (escrita já era só servidor)
-- ---------------------------------------------------------------------
drop policy if exists "Admins visualizam auditoria" on public.wa_auditoria;
drop policy if exists "wa_auditoria: admin, conta liberada" on public.wa_auditoria;
create policy "wa_auditoria: admin, conta liberada"
  on public.wa_auditoria for select to authenticated
  using (public.wa_conta_liberada() and public.wa_eh_admin());

-- ---------------------------------------------------------------------
-- 4. docusign_envelopes: leitura admin; escrita só servidor
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'docusign_envelopes'
  loop
    execute format('drop policy %I on public.docusign_envelopes', p.policyname);
  end loop;
end
$$;
revoke insert, update, delete on public.docusign_envelopes from authenticated, anon;
grant select on public.docusign_envelopes to authenticated;
grant all on public.docusign_envelopes to service_role;
create policy "docusign_envelopes: admin, conta liberada"
  on public.docusign_envelopes for select to authenticated
  using (public.wa_conta_liberada() and public.wa_eh_admin());

-- Órfãos (envelopes de campanhas já apagadas) deixam de apontar para lugar nenhum; daí as FKs.
update public.docusign_envelopes e set campanha_id = null
 where e.campanha_id is not null and not exists (select 1 from public.wa_campanhas c where c.id = e.campanha_id);
update public.docusign_envelopes e set destinatario_id = null
 where e.destinatario_id is not null
   and not exists (select 1 from public.wa_campanha_destinatarios d where d.id = e.destinatario_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'docusign_envelopes_campanha_fk') then
    alter table public.docusign_envelopes
      add constraint docusign_envelopes_campanha_fk
      foreign key (campanha_id) references public.wa_campanhas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'docusign_envelopes_destinatario_fk') then
    alter table public.docusign_envelopes
      add constraint docusign_envelopes_destinatario_fk
      foreign key (destinatario_id) references public.wa_campanha_destinatarios(id) on delete set null;
  end if;
end
$$;
create index if not exists idx_docusign_envelopes_campanha on public.docusign_envelopes (campanha_id);

-- ---------------------------------------------------------------------
-- 5. api_registry: leitura admin com conta liberada; escrita só servidor
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.api_registry') is null then
    return;
  end if;
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'api_registry'
  loop
    execute format('drop policy %I on public.api_registry', p.policyname);
  end loop;
  execute 'revoke insert, update, delete on public.api_registry from authenticated, anon';
  execute 'grant select on public.api_registry to authenticated';
  execute 'grant all on public.api_registry to service_role';
  execute 'alter table public.api_registry enable row level security';
  execute $p$
    create policy "api_registry: admin, conta liberada"
      on public.api_registry for select to authenticated
      using (public.wa_conta_liberada() and public.wa_eh_admin())
  $p$;
end
$$;

-- ---------------------------------------------------------------------
-- 6. Guard de wa_project_users: allowlist
-- ---------------------------------------------------------------------
create or replace function public.wa_project_users_guard()
returns trigger
language plpgsql
as $$
begin
  -- Só a service_role (server functions) ou uma sessão sem JWT (SQL Editor, migrações) escrevem.
  if coalesce(auth.role(), '') not in ('', 'service_role', 'postgres', 'supabase_admin') then
    raise exception 'O acesso ao portal só é alterado pela tela Usuários.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 7. user_roles (projeto compartilhado): ninguém concede papel elevado a si mesmo pela Data API
-- ---------------------------------------------------------------------
create or replace function public.user_roles_sem_autopromocao()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
     and new.user_id = auth.uid()
     and new.role::text <> 'cliente' then
    raise exception 'Papéis são definidos por um administrador.' using errcode = '42501';
  end if;
  return new;
end
$$;
do $$
begin
  if to_regclass('public.user_roles') is null then
    return;
  end if;
  execute 'drop trigger if exists trg_user_roles_sem_autopromocao on public.user_roles';
  execute 'create trigger trg_user_roles_sem_autopromocao before insert or update on public.user_roles
             for each row execute function public.user_roles_sem_autopromocao()';
end
$$;

-- ---------------------------------------------------------------------
-- 8. FKs com ON DELETE
-- ---------------------------------------------------------------------
do $$
declare
  v_con text;
begin
  -- wa_auditoria.usuario_id → set null
  select conname into v_con from pg_constraint
   where conrelid = 'public.wa_auditoria'::regclass and contype = 'f'
     and pg_get_constraintdef(oid) like '%(usuario_id)%' limit 1;
  if v_con is not null and v_con <> 'wa_auditoria_usuario_fk' then
    execute format('alter table public.wa_auditoria drop constraint %I', v_con);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wa_auditoria_usuario_fk') then
    alter table public.wa_auditoria
      add constraint wa_auditoria_usuario_fk foreign key (usuario_id) references auth.users(id) on delete set null;
  end if;

  -- wa_project_users.adicionado_por → set null (se a coluna existir)
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'wa_project_users' and column_name = 'adicionado_por') then
    v_con := null;
    select conname into v_con from pg_constraint
     where conrelid = 'public.wa_project_users'::regclass and contype = 'f'
       and pg_get_constraintdef(oid) like '%(adicionado_por)%' limit 1;
    if v_con is not null and v_con <> 'wa_project_users_adicionado_por_fk' then
      execute format('alter table public.wa_project_users drop constraint %I', v_con);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'wa_project_users_adicionado_por_fk') then
      alter table public.wa_project_users
        add constraint wa_project_users_adicionado_por_fk
        foreign key (adicionado_por) references auth.users(id) on delete set null;
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 9. Limite de login: atômico, IP separado, defaults, hook alinhado
-- ---------------------------------------------------------------------
alter table public.auth_bloqueio_config add column if not exists max_falhas_ip integer not null default 20;
alter table public.auth_bloqueio_config add column if not exists bloqueio_ip_minutos integer not null default 15;
alter table public.auth_falhas_por_usuario add column if not exists primeira_falha_em timestamptz;
alter table public.auth_falhas_por_usuario add column if not exists bloqueios integer not null default 0;

-- Parâmetros com defaults no código: sem linha de config, ainda bloqueia.
create or replace function public.auth_bloqueio_parametros()
returns table (max_falhas int, janela_minutos int, bloqueio_minutos int, bloqueio_max_horas int,
               max_falhas_ip int, bloqueio_ip_minutos int)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.max_falhas, 5), coalesce(c.janela_minutos, 15), coalesce(c.bloqueio_minutos, 15),
         coalesce(c.bloqueio_max_horas, 24), coalesce(c.max_falhas_ip, 20), coalesce(c.bloqueio_ip_minutos, 15)
    from (select 1) x
    left join public.auth_bloqueio_config c on c.id;
$$;
revoke all on function public.auth_bloqueio_parametros() from public, anon, authenticated;
grant execute on function public.auth_bloqueio_parametros() to service_role, supabase_auth_admin;

-- Antes de autenticar: reserva a tentativa (conta + IP) e bloqueia se já passou do limite.
-- A contagem acontece AQUI, antes de o GoTrue ver a senha: N requisições paralelas são serializadas
-- pelo lock de linha, então nunca mais de max_falhas senhas chegam a ser testadas na janela.
create or replace function public.auth_pre_login(p_email text, p_ip text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
  v_email text := lower(coalesce(p_email, ''));
  v_ip text := coalesce(p_ip, '');
  v_chaves text[];
  k text;
  v_max int;
  v_bloqueio interval;
  v_backoff boolean;
  t record;
  v_ate timestamptz;
begin
  select * into cfg from public.auth_bloqueio_parametros();

  v_chaves := array['conta:' || v_email];
  if v_ip <> '' and v_ip <> 'desconhecido' then
    v_chaves := v_chaves || ('ip:' || v_ip);
  end if;

  foreach k in array v_chaves loop
    if k like 'conta:%' then
      v_max := cfg.max_falhas; v_bloqueio := make_interval(mins => cfg.bloqueio_minutos); v_backoff := true;
    else
      v_max := cfg.max_falhas_ip; v_bloqueio := make_interval(mins => cfg.bloqueio_ip_minutos); v_backoff := false;
    end if;

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
      ultima_falha_em = now()
    returning * into t;

    -- já bloqueado?
    if t.bloqueado_ate is not null and t.bloqueado_ate > now() then
      v_ate := greatest(coalesce(v_ate, t.bloqueado_ate), t.bloqueado_ate);
      continue;
    end if;

    -- passou do limite nesta tentativa → bloqueia (backoff só por conta)
    if t.falhas > v_max then
      update public.auth_tentativas a
         set bloqueios = a.bloqueios + 1,
             bloqueado_ate = now() + case when v_backoff
               then least(v_bloqueio * power(2, a.bloqueios), make_interval(hours => cfg.bloqueio_max_horas))
               else v_bloqueio end,
             falhas = 0,
             primeira_falha_em = null
       where a.chave = k
       returning a.bloqueado_ate into v_ate;
    end if;
  end loop;

  if v_ate is not null then
    return jsonb_build_object('permitido', false, 'ate', v_ate);
  end if;
  return jsonb_build_object('permitido', true);
end
$$;

-- Depois de autenticar: registra o resultado. Sucesso zera os contadores (conta, IP e hook).
-- Falha: a tentativa já foi contada em auth_pre_login; aqui só se aplica o bloqueio se a conta
-- chegou exatamente ao limite (para a 5ª senha errada já responder "bloqueado").
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
  v_email text := lower(coalesce(p_email, ''));
  v_ip text := coalesce(p_ip, '');
  v_bloqueado boolean := false;
  v_ate timestamptz;
  v_tmp timestamptz;
begin
  select * into cfg from public.auth_bloqueio_parametros();

  insert into public.auth_login_log (email_norm, user_id, ip, user_agent, origem, resultado)
  values (
    v_email, p_user_id, nullif(v_ip, ''), left(p_ua, 300), coalesce(p_origem, 'login'),
    coalesce(p_resultado, case when p_ok then 'ok' else 'credencial_invalida' end)
  );

  if p_ok then
    delete from public.auth_tentativas where chave = 'conta:' || v_email or (v_ip <> '' and chave = 'ip:' || v_ip);
    if p_user_id is not null then
      delete from public.auth_falhas_por_usuario where user_id = p_user_id;
    end if;
    return jsonb_build_object('bloqueado', false);
  end if;

  -- conta: bloqueia ao atingir o limite (backoff)
  update public.auth_tentativas a
     set bloqueios = a.bloqueios + 1,
         bloqueado_ate = now() + least(
           make_interval(mins => cfg.bloqueio_minutos) * power(2, a.bloqueios),
           make_interval(hours => cfg.bloqueio_max_horas)),
         falhas = 0,
         primeira_falha_em = null
   where a.chave = 'conta:' || v_email
     and a.falhas >= cfg.max_falhas
     and (a.bloqueado_ate is null or a.bloqueado_ate <= now())
   returning a.bloqueado_ate into v_tmp;
  if v_tmp is not null then v_bloqueado := true; v_ate := v_tmp; end if;

  -- ip: bloqueio fixo ao atingir o limite
  if v_ip <> '' and v_ip <> 'desconhecido' then
    v_tmp := null;
    update public.auth_tentativas a
       set bloqueios = a.bloqueios + 1,
           bloqueado_ate = now() + make_interval(mins => cfg.bloqueio_ip_minutos),
           falhas = 0,
           primeira_falha_em = null
     where a.chave = 'ip:' || v_ip
       and a.falhas >= cfg.max_falhas_ip
       and (a.bloqueado_ate is null or a.bloqueado_ate <= now())
     returning a.bloqueado_ate into v_tmp;
    if v_tmp is not null then v_bloqueado := true; v_ate := greatest(coalesce(v_ate, v_tmp), v_tmp); end if;
  end if;

  return jsonb_build_object('bloqueado', v_bloqueado, 'ate', v_ate);
end
$$;

-- Hook do GoTrue (por conta): mesma janela fixa e mesmo backoff da server function.
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
  select * into cfg from public.auth_bloqueio_parametros();

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

  insert into public.auth_falhas_por_usuario (user_id, falhas, primeira_falha_em, ultima_falha_em)
  values (v_uid, 1, now(), now())
  on conflict (user_id) do update set
    falhas = case
      when public.auth_falhas_por_usuario.primeira_falha_em is null
        or public.auth_falhas_por_usuario.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
      then 1 else public.auth_falhas_por_usuario.falhas + 1 end,
    primeira_falha_em = case
      when public.auth_falhas_por_usuario.primeira_falha_em is null
        or public.auth_falhas_por_usuario.primeira_falha_em < now() - make_interval(mins => cfg.janela_minutos)
      then now() else public.auth_falhas_por_usuario.primeira_falha_em end,
    ultima_falha_em = now();

  update public.auth_falhas_por_usuario u
     set bloqueios = u.bloqueios + 1,
         bloqueado_ate = now() + least(
           make_interval(mins => cfg.bloqueio_minutos) * power(2, u.bloqueios),
           make_interval(hours => cfg.bloqueio_max_horas)),
         falhas = 0,
         primeira_falha_em = null
   where u.user_id = v_uid and u.falhas >= cfg.max_falhas;

  return jsonb_build_object('decision', 'continue');
end
$$;

revoke all on function public.auth_pre_login(text, text) from public, anon, authenticated;
revoke all on function public.auth_registrar_resultado(text, text, boolean, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.hook_verificacao_senha(jsonb) from public, anon, authenticated;
grant execute on function public.auth_pre_login(text, text) to service_role;
grant execute on function public.auth_registrar_resultado(text, text, boolean, uuid, text, text, text) to service_role;
grant execute on function public.hook_verificacao_senha(jsonb) to supabase_auth_admin;
grant select on public.auth_bloqueio_config to supabase_auth_admin;
