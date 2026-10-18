
DO $$
DECLARE
  v_user_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'diego.pimentel@calper.com.br';

  IF v_existing IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'diego.pimentel@calper.com.br',
      -- senha inicial fora do repositório: app.senha_inicial (SET no SQL Editor) ou aleatória
      crypt(coalesce(nullif(current_setting('app.senha_inicial', true), ''), encode(gen_random_bytes(24), 'base64')), gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Diego Pimentel"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'diego.pimentel@calper.com.br', 'email_verified', true),
      'email',
      now(), now(), now()
    );
  ELSE
    v_user_id := v_existing;
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_user_id, 'Diego Pimentel', 'diego.pimentel@calper.com.br')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
