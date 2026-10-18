
-- 1) Enable RLS on tables exposed via PostgREST (rh/comercial/financeiro/obras)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT n.nspname, c.relname
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND c.relrowsecurity = false
              AND n.nspname IN ('rh','comercial','financeiro','obras')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.nspname, r.relname);
  END LOOP;
END $$;

-- 2) Views SECURITY INVOKER
ALTER VIEW public.admissao_documentos SET (security_invoker = true);
ALTER VIEW public.admissao_timeline SET (security_invoker = true);
ALTER VIEW public.solicitacoes_admissao SET (security_invoker = true);
ALTER VIEW public.vagas SET (security_invoker = true);

-- 3) Tighten permissive policies
DROP POLICY IF EXISTS "Authenticated read api_registry" ON public.api_registry;
DROP POLICY IF EXISTS "Authenticated read totvs_config" ON public.totvs_config;

DROP POLICY IF EXISTS "Public reads active assistente presets" ON public.ai_prompt_presets;
CREATE POLICY "Authenticated read active assistente presets"
  ON public.ai_prompt_presets FOR SELECT TO authenticated
  USING (escopo = 'assistente' AND ativo = true);

DROP POLICY IF EXISTS "Auth pode gerenciar form campaigns" ON public.bulk_form_campaigns;
CREATE POLICY "Admins manage form campaigns"
  ON public.bulk_form_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Auth pode gerenciar form links" ON public.bulk_form_links;
CREATE POLICY "Admins manage form links"
  ON public.bulk_form_links FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Auth pode gerenciar respostas" ON public.bulk_form_responses;
DROP POLICY IF EXISTS "Auth pode ver respostas" ON public.bulk_form_responses;
CREATE POLICY "Admins manage form responses"
  ON public.bulk_form_responses FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Autenticados podem ler assinaturas" ON public.campanha_assinaturas;
CREATE POLICY "Admins can read assinaturas"
  ON public.campanha_assinaturas FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Autenticados podem ler logs" ON public.campanha_assinatura_logs;
DROP POLICY IF EXISTS "Autenticados podem inserir logs" ON public.campanha_assinatura_logs;
CREATE POLICY "Admins can read assinatura logs"
  ON public.campanha_assinatura_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));
CREATE POLICY "Admins can insert assinatura logs"
  ON public.campanha_assinatura_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read totvs cache" ON public.clientes_totvs_cache;
CREATE POLICY "Admins can read totvs cache"
  ON public.clientes_totvs_cache FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read cockpit cache" ON public.crc_cockpit_cache;
DROP POLICY IF EXISTS "Authenticated can insert cockpit cache" ON public.crc_cockpit_cache;
DROP POLICY IF EXISTS "Authenticated can update cockpit cache" ON public.crc_cockpit_cache;
DROP POLICY IF EXISTS "Authenticated can delete cockpit cache" ON public.crc_cockpit_cache;
CREATE POLICY "Admins manage cockpit cache"
  ON public.crc_cockpit_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read project members" ON public.wa_project_users;
CREATE POLICY "Members and admins read project members"
  ON public.wa_project_users FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'super_admin'::app_role)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated users can read whatsapp_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp_config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Admins manage whatsapp_config"
  ON public.whatsapp_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role));

-- 4) Storage object policies (admissao-documentos, atendimento-assinaturas, formulario-respostas)
DROP POLICY IF EXISTS "Allow read admissao docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload admissao docs" ON storage.objects;
CREATE POLICY "Admins read admissao docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admissao-documentos'
         AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));
CREATE POLICY "Admins upload admissao docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admissao-documentos'
              AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Auth manage assinaturas" ON storage.objects;
CREATE POLICY "Admins manage assinaturas"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'atendimento-assinaturas'
         AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'atendimento-assinaturas'
              AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Auth leitura respostas" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload respostas" ON storage.objects;
DROP POLICY IF EXISTS "Auth update respostas" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete respostas" ON storage.objects;
CREATE POLICY "Admins manage respostas"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'formulario-respostas'
         AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'formulario-respostas'
              AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'super_admin'::app_role)));

-- 5) Revoke SECURITY DEFINER function execution from anon and (trigger-only) from authenticated
REVOKE ALL ON FUNCTION public.assistente_kb_log_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.cancel_client_agendamento(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_client_agendamento(uuid, date, time, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_client_agendamento(uuid, date, time, uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_project_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_resposta_kit_porcelanato(text, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_tipo_evento_horarios(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_handoff(uuid, text, text, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_horario_ativo(text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_tipo_atendimento_ativo(uuid, boolean) FROM PUBLIC, anon;
