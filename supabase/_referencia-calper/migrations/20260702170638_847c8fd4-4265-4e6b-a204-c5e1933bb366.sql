
-- Restore SELECT on api_registry for authenticated users
GRANT SELECT ON public.api_registry TO authenticated;

DROP POLICY IF EXISTS "Authenticated read api_registry" ON public.api_registry;
CREATE POLICY "Authenticated read api_registry"
  ON public.api_registry
  FOR SELECT
  TO authenticated
  USING (true);

-- Restore SELECT on totvs_config for admin/super_admin
GRANT SELECT ON public.totvs_config TO authenticated;

DROP POLICY IF EXISTS "Authenticated read totvs_config" ON public.totvs_config;
CREATE POLICY "Authenticated read totvs_config"
  ON public.totvs_config
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );
