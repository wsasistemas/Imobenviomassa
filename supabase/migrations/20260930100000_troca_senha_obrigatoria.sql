-- =====================================================================
-- Disparo em Massa — troca de senha obrigatória e regras de acesso no banco
-- (mesmo modelo do Portal DP e do Gestão de Contratos)
--
--   1. wa_project_users ganha trocar_senha; quem cria o usuário (Super Admin) define a senha inicial e
--      no primeiro acesso a pessoa é obrigada a trocá-la. "Definir senha" também exige nova troca.
--   2. ativo e trocar_senha só mudam pelo servidor (service_role). Pela Data API ninguém — nem Admin —
--      insere, altera ou apaga linhas de wa_project_users; a flag só é desligada pela server function
--      trocarMinhaSenha, que confere a senha atual e grava a nova.
--   3. docusign_config (chave RSA, integration key) sai da Data API: só o servidor lê e grava.
--   4. api_registry (Gateway): só Super Admin cadastra ou apaga APIs — uma API apontando para outro
--      host poderia receber as credenciais do RM.
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Troca de senha obrigatória
-- ---------------------------------------------------------------------
alter table public.wa_project_users
  add column if not exists trocar_senha boolean not null default false;

-- Quem já tem papel de trabalho passa a ter linha de membro (ativo, sem troca pendente). A partir
-- daqui, quem não tem linha não tem acesso.
insert into public.wa_project_users (user_id, ativo, trocar_senha)
select distinct r.user_id, true, false
  from public.user_roles r
 where r.role in ('super_admin', 'admin', 'operadora')
on conflict (user_id) do nothing;

-- A função antiga (versão anterior desta migração) liberava a flag sem provar a troca da senha.
drop function if exists public.confirmar_troca_senha();

-- ---------------------------------------------------------------------
-- 2. wa_project_users: escrita só pelo servidor
-- ---------------------------------------------------------------------
drop policy if exists "Admins can insert project members" on public.wa_project_users;
drop policy if exists "Admins can update project members" on public.wa_project_users;
drop policy if exists "Admins can delete project members" on public.wa_project_users;
revoke insert, update, delete on public.wa_project_users from authenticated, anon;
grant select on public.wa_project_users to authenticated;
grant all on public.wa_project_users to service_role;

-- Segunda tranca: mesmo que alguma policy volte, uma sessão de usuário (JWT "authenticated") não
-- escreve nesta tabela. auth.role() lê o papel do JWT da requisição (service_role passa; SQL Editor,
-- sem JWT, passa).
create or replace function public.wa_project_users_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'O acesso ao portal só é alterado pela tela Usuários.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists trg_wa_project_users_guard on public.wa_project_users;
create trigger trg_wa_project_users_guard
  before insert or update or delete on public.wa_project_users
  for each row execute function public.wa_project_users_guard();

-- ---------------------------------------------------------------------
-- 3. docusign_config: fora da Data API (o app lê e grava com a service_role)
-- ---------------------------------------------------------------------
drop policy if exists "Admins podem ver config docusign" on public.docusign_config;
drop policy if exists "Admins podem inserir config docusign" on public.docusign_config;
drop policy if exists "Admins podem atualizar config docusign" on public.docusign_config;
drop policy if exists "Admins podem apagar config docusign" on public.docusign_config;
revoke all on public.docusign_config from public, anon, authenticated;
grant all on public.docusign_config to service_role;
alter table public.docusign_config enable row level security; -- sem policies: só service_role

-- ---------------------------------------------------------------------
-- 4. api_registry: leitura para todo perfil logado; escrita só para Super Admin
-- ---------------------------------------------------------------------
do $$
declare
  p record;
begin
  -- remove qualquer policy de escrita criada fora do repositório
  for p in
    select policyname
      from pg_policies
     where schemaname = 'public' and tablename = 'api_registry'
       and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on public.api_registry', p.policyname);
  end loop;
end
$$;

alter table public.api_registry enable row level security;
grant select, insert, update, delete on public.api_registry to authenticated;
grant all on public.api_registry to service_role;

create policy "Super admin gerencia api_registry"
  on public.api_registry for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));
