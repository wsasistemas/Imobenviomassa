-- =====================================================================================================
-- Primeira imobiliária e o primeiro Super Admin do Imobenviomassa (rodar no SQL Editor, depois do 3 e do 4).
--
-- O login do ikvj é compartilhado (ImobSystem, Imobsuprimentos, ImobDoces): a conta já existe em
-- auth.users, então aqui NÃO há senha — só o vínculo da conta com a imobiliária e o perfil.
-- Troque os dois valores marcados abaixo antes de rodar. Pode rodar de novo: não duplica.
-- =====================================================================================================
begin;

do $$
declare
  v_email text := lower('<EMAIL_DO_SUPER_ADMIN>');        -- << troque: e-mail da conta que já entra no ImobSystem
  v_nome_imob text := 'WSA Sistemas IA (interna)';        -- << troque, se quiser: nome da primeira imobiliária
  v_uid uuid;
  v_imob uuid;
begin
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
