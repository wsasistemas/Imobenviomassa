
CREATE TABLE public.wa_project_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  adicionado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_project_users TO authenticated;
GRANT ALL ON public.wa_project_users TO service_role;

ALTER TABLE public.wa_project_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read project members"
  ON public.wa_project_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert project members"
  ON public.wa_project_users FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins can update project members"
  ON public.wa_project_users FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Admins can delete project members"
  ON public.wa_project_users FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE TRIGGER trg_wa_project_users_updated_at
  BEFORE UPDATE ON public.wa_project_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.wa_project_users (user_id, ativo)
VALUES ('de982456-2934-49b6-9b03-3f6c773e855c', true)
ON CONFLICT (user_id) DO NOTHING;
