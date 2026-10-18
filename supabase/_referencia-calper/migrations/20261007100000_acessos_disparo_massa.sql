-- Disparo em Massa na Central de acessos (Permissões por aplicativo) — mesmo escopo do Gestão de Contratos.
--
-- O portal guarda os dados no schema `public` (compartilhado), então ele entra na Central como aplicativo
-- "adicionado à mão" com a chave `disparo_massa` (src/lib/app-key.ts). Para a Central saber quem tem
-- cadastro, quais perfis existem e como cadastrar quem for liberado, este schema segue o Contrato Calper:
--   disparo_massa.usuarios (id, email, nome, perfil, ativo)  e  disparo_massa.perfis (chave, nome, ordem).
-- São views sobre as tabelas reais do portal (public.wa_project_users + public.user_roles + public.profiles),
-- com gatilhos INSTEAD OF para o cadastro automático. Assim os adaptadores genéricos da Central
-- (acessos.tem_cadastro, acessos.provisionar, acessos.perfis_do_app, acessos.perfil_padrao) atendem o
-- Disparo em Massa SEM alterar nenhuma função compartilhada.
--
-- Regras (iguais ao Contratos):
--   * "Cadastrado (origem)" = tem linha em wa_project_users.
--   * Liberar quem não tem cadastro cria a linha ativa, sem troca de senha (login único Calper), e grava o
--     papel do "Perfil ao liberar" (padrão: Analista = operadora).
--   * Liberar quem tem linha inativa só reativa; se a pessoa estiver sem papel, recebe o perfil ao liberar.
--   * A Central nunca rebaixa nem remove papéis; quem gerencia perfil continua sendo Administração › Usuários.
-- Duas travas, como no Contratos: a da Central (public.pode_acessar_app) e a do portal (wa_project_users + papel).
-- Aditiva e idempotente: pode rodar de novo.

create schema if not exists disparo_massa;
revoke all on schema disparo_massa from public, anon, authenticated;
comment on schema disparo_massa is 'Contrato Calper do Disparo em Massa para a Central de acessos (views sobre public.wa_project_users/user_roles).';

-- ---------------------------------------------------------------------
-- Perfis (do mais amplo para o mais simples; o último é o padrão ao liberar)
-- ---------------------------------------------------------------------
create or replace view disparo_massa.perfis as
select v.chave, v.nome, v.ordem
from (values ('super_admin', 'Super Admin', 1),
             ('admin', 'Admin', 2),
             ('operadora', 'Analista', 3)) as v(chave, nome, ordem);

-- ---------------------------------------------------------------------
-- Usuários do portal
-- ---------------------------------------------------------------------
create or replace view disparo_massa.usuarios as
select
  m.user_id as id,
  lower(u.email)::text as email,
  coalesce(nullif(btrim(p.full_name), ''),
           nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
           initcap(replace(split_part(u.email, '@', 1), '.', ' ')))::text as nome,
  (select r.role::text from public.user_roles r
    where r.user_id = m.user_id and r.role::text in ('super_admin', 'admin', 'operadora')
    order by case r.role::text when 'super_admin' then 1 when 'admin' then 2 else 3 end
    limit 1) as perfil,
  m.ativo
from public.wa_project_users m
join auth.users u on u.id = m.user_id
left join public.profiles p on p.id = m.user_id;

revoke all on all tables in schema disparo_massa from public, anon, authenticated;

-- Grava o papel do portal se a pessoa ainda não tiver nenhum (nunca rebaixa).
create or replace function disparo_massa.garantir_papel(p_usuario uuid, p_perfil text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_perfil is null or p_perfil not in ('super_admin', 'admin', 'operadora') then
    return;
  end if;
  if not exists (select 1 from public.user_roles r
                 where r.user_id = p_usuario and r.role::text in ('super_admin', 'admin', 'operadora')) then
    insert into public.user_roles (user_id, role) values (p_usuario, p_perfil::public.app_role);
  end if;
end;
$$;

create or replace function disparo_massa.usuarios_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Remova o acesso pela tela Usuários do Disparo em Massa.';
  end if;

  if tg_op = 'INSERT' then
    -- Cadastro pela Central: linha ativa, sem troca de senha (a pessoa usa a senha do login único).
    insert into public.wa_project_users (user_id, ativo, trocar_senha, adicionado_por)
    values (new.id, coalesce(new.ativo, true), false, (select auth.uid()))
    on conflict (user_id) do update set ativo = excluded.ativo, updated_at = now();

    if not exists (select 1 from public.profiles x where x.id = new.id) then
      insert into public.profiles (id, user_id, full_name, email, is_active)
      values (new.id, new.id, new.nome, new.email, true);
    end if;

    perform disparo_massa.garantir_papel(new.id, coalesce(new.perfil, acessos.perfil_liberar_de('disparo_massa')));
    return new;
  end if;

  -- UPDATE: a Central só reativa (set ativo = true).
  if new.ativo is distinct from old.ativo then
    update public.wa_project_users set ativo = new.ativo, updated_at = now() where user_id = old.id;
  end if;
  if new.ativo then
    v_perfil := coalesce(new.perfil, acessos.perfil_liberar_de('disparo_massa'));
    perform disparo_massa.garantir_papel(old.id, v_perfil);
  end if;
  return new;
end;
$$;

drop trigger if exists usuarios_gravar on disparo_massa.usuarios;
create trigger usuarios_gravar
  instead of insert or update or delete on disparo_massa.usuarios
  for each row execute function disparo_massa.usuarios_gravar();

revoke execute on function disparo_massa.garantir_papel(uuid, text) from public, anon, authenticated;
revoke execute on function disparo_massa.usuarios_gravar() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Cadastro do aplicativo na Central
-- ---------------------------------------------------------------------
-- Controle começa DESLIGADO (todos entram, como hoje). O Super admin da Central liga em
-- Administração › Permissões por aplicativo › Disparo em Massa. Se o app já tinha sido adicionado à mão
-- com o schema de dados "public" (ou estava oculto na lista), passa a usar o contrato acima e volta a aparecer.
insert into acessos.aplicativos (schema_name, nome, url, schema_dados, manual, exposto, configurado, perfil_liberar)
values ('disparo_massa', 'Disparo em Massa', null, 'disparo_massa', true, true, true, 'operadora')
on conflict (schema_name) do update
  set schema_dados = 'disparo_massa',
      manual = true,
      exposto = true,
      oculto = false,
      perfil_liberar = coalesce(acessos.aplicativos.perfil_liberar, 'operadora'),
      atualizado_em = now();

notify pgrst, 'reload schema';

-- Conferência (rode à parte):
--   select acessos.segue_contrato('disparo_massa');            -- true
--   select acessos.perfis_do_app('disparo_massa');             -- Super Admin, Admin, Analista
--   select acessos.perfil_liberar_de('disparo_massa');         -- operadora
--   select count(*) from disparo_massa.usuarios;               -- mesmos membros da tela Usuários
--   select schema_name, nome, manual, exposto, oculto from acessos.aplicativos where schema_name = 'disparo_massa';
