
DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'ti@calper.com.br';
  -- Senha inicial NUNCA fica no repositório: vem de app.senha_inicial (SET no SQL Editor antes de
  -- rodar) ou é aleatória — nesse caso defina a senha depois em Administração → Usuários.
  v_password text := coalesce(nullif(current_setting('app.senha_inicial', true), ''), encode(gen_random_bytes(24), 'base64'));
  v_full_name text := 'TI Calper';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_full_name),
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text,
      now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                                  || jsonb_build_object('full_name', v_full_name),
           updated_at = now()
     WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_user_id, v_full_name, v_email)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove o papel padrão "cliente" caso tenha sido criado pelo trigger handle_new_user.
  DELETE FROM public.user_roles
   WHERE user_id = v_user_id
     AND role = 'cliente'::public.app_role;
END $$;
