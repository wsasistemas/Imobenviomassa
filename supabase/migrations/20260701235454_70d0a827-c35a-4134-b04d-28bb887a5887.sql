-- DocuSign configuration table (single row per project)
CREATE TABLE public.docusign_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambiente text NOT NULL DEFAULT 'demo' CHECK (ambiente IN ('demo','producao')),
  base_url text NOT NULL DEFAULT 'https://demo.docusign.net/restapi/v2.1',
  auth_url text NOT NULL DEFAULT 'https://account-d.docusign.com',
  account_id text,
  integration_key text,
  impersonated_user_id text,
  rsa_private_key text,
  default_template_id text,
  webhook_secret text,
  access_token_cache text,
  access_token_expira_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.docusign_config TO authenticated;
GRANT ALL ON public.docusign_config TO service_role;

ALTER TABLE public.docusign_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver config docusign"
ON public.docusign_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Admins podem inserir config docusign"
ON public.docusign_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Admins podem atualizar config docusign"
ON public.docusign_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Admins podem apagar config docusign"
ON public.docusign_config FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'super_admin'::app_role));

CREATE TRIGGER trg_docusign_config_updated_at
BEFORE UPDATE ON public.docusign_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Envelope tracking
CREATE TABLE public.docusign_envelopes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id uuid,
  destinatario_id uuid,
  envelope_id text NOT NULL UNIQUE,
  template_id text,
  status text,
  sent_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  last_event_at timestamptz DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.docusign_envelopes TO authenticated;
GRANT ALL ON public.docusign_envelopes TO service_role;

ALTER TABLE public.docusign_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem envelopes docusign"
ON public.docusign_envelopes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Admins gerenciam envelopes docusign"
ON public.docusign_envelopes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE INDEX idx_docusign_envelopes_campanha ON public.docusign_envelopes(campanha_id);
CREATE INDEX idx_docusign_envelopes_status ON public.docusign_envelopes(status);
CREATE INDEX idx_docusign_envelopes_dest ON public.docusign_envelopes(destinatario_id);