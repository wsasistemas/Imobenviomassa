-- =====================================================================================================
-- Super Admin do Imobenviomassa: wsasistemas.ia@gmail.com (rodar no SQL Editor do ikvjaowvpvxojvcfwnct).
--
-- É o 5_primeira_imobiliaria.sql já preenchido. Pré-requisito: 1 a 4 já aplicados (schema imobenviomassa
-- e a estrutura). A conta já existe no login compartilhado (ImobSystem, Imobsuprimentos, ImobDoces):
-- aqui NÃO há senha, só o vínculo com a imobiliária, o perfil super_admin e a liberação na Central.
-- Pode rodar de novo: não duplica.
-- =====================================================================================================
begin;

do $$
declare
  v_email text := 'wsasistemas.ia@gmail.com';
  v_nome_imob text := 'WSA Sistemas IA (interna)';
  v_uid uuid;
  v_imob uuid;
begin
  if to_regclass('imobenviomassa.usuarios') is null then
    raise exception 'Estrutura do imobenviomassa não aplicada. Rode antes o 1_criar_schema.sql e o 3_aplicar_estrutura.sql.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    raise exception 'Conta % não existe no login do ikvj. Crie a conta (Authentication > Users) e rode de novo.', v_email;
  end if;

  select id into v_imob from imobenviomassa.imobiliarias where lower(nome) = lower(v_nome_imob);
  if v_imob is null then
    insert into imobenviomassa.imobiliarias (nome) values (v_nome_imob) returning id into v_imob;
  end if;

  insert into imobenviomassa.usuarios (id, imobiliaria_id, email, nome, perfil, ativo, trocar_senha)
  select v_uid, v_imob, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 'super_admin', true, false
    from auth.users u where u.id = v_uid
  on conflict (id) do update set imobiliaria_id = excluded.imobiliaria_id, perfil = 'super_admin', ativo = true;

  -- Liberação manual na Central (vale mesmo com o controle de acesso ligado).
  insert into acessos.permissoes (schema_name, user_id, pode_entrar, origem_decisao)
  values ('imobenviomassa', v_uid, true, 'manual')
  on conflict (schema_name, user_id) do update set pode_entrar = true, origem_decisao = 'manual';

  raise notice 'Pronto: % é Super Admin da imobiliária "%" (%).', v_email, v_nome_imob, v_imob;
end $$;

commit;

-- Conferência: deve voltar 1 linha com perfil super_admin, ativo true, imobiliária ativa e pode_entrar true.
select u.email, u.perfil, u.ativo, u.trocar_senha, i.nome as imobiliaria, i.ativo as imobiliaria_ativa, p.pode_entrar
  from imobenviomassa.usuarios u
  join imobenviomassa.imobiliarias i on i.id = u.imobiliaria_id
  left join acessos.permissoes p on p.user_id = u.id and p.schema_name = 'imobenviomassa'
 where lower(u.email) = 'wsasistemas.ia@gmail.com';
