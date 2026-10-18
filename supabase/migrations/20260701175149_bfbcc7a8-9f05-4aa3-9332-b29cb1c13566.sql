
DO $$ BEGIN
  CREATE TYPE public.wa_campanha_status AS ENUM ('rascunho','rascunho_confirmado','em_execucao','concluida','erro','cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_destinatario_status AS ENUM ('pendente','enviado','entregue','assinado','erro','opt_out');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_campanha_origem AS ENUM ('totvs','excel');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.wa_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  origem public.wa_campanha_origem NOT NULL,
  filtros_origem jsonb NOT NULL DEFAULT '{}'::jsonb,
  modelo_docusign_id text,
  modelo_docusign_nome text,
  config_assinatura jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagem_whatsapp text NOT NULL DEFAULT '',
  status public.wa_campanha_status NOT NULL DEFAULT 'rascunho',
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campanhas TO authenticated;
GRANT ALL ON public.wa_campanhas TO service_role;

ALTER TABLE public.wa_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e super_admins veem todas as campanhas"
  ON public.wa_campanhas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE POLICY "Criador vê suas campanhas"
  ON public.wa_campanhas FOR SELECT TO authenticated
  USING (criado_por = auth.uid());

CREATE POLICY "Autenticados criam campanhas próprias"
  ON public.wa_campanhas FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Criador ou admin atualiza campanha"
  ON public.wa_campanhas FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  WITH CHECK (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE POLICY "Criador ou admin deleta campanha"
  ON public.wa_campanhas FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role));

CREATE TRIGGER trg_wa_campanhas_updated_at
  BEFORE UPDATE ON public.wa_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wa_campanha_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES public.wa_campanhas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  telefone text,
  email text,
  empreendimento text,
  bloco text,
  unidade text,
  dados_extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.wa_destinatario_status NOT NULL DEFAULT 'pendente',
  erro_msg text,
  envelope_docusign_id text,
  enviado_em timestamptz,
  assinado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_destinatarios_campanha ON public.wa_campanha_destinatarios(campanha_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_campanha_destinatarios TO authenticated;
GRANT ALL ON public.wa_campanha_destinatarios TO service_role;

ALTER TABLE public.wa_campanha_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver destinatários de campanhas acessíveis"
  ON public.wa_campanha_destinatarios FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wa_campanhas c
    WHERE c.id = campanha_id
      AND (c.criado_por = auth.uid()
        OR public.has_role(auth.uid(),'admin'::public.app_role)
        OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  ));

CREATE POLICY "Inserir destinatários em campanha própria"
  ON public.wa_campanha_destinatarios FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wa_campanhas c
    WHERE c.id = campanha_id
      AND (c.criado_por = auth.uid()
        OR public.has_role(auth.uid(),'admin'::public.app_role)
        OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  ));

CREATE POLICY "Atualizar destinatários acessíveis"
  ON public.wa_campanha_destinatarios FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wa_campanhas c
    WHERE c.id = campanha_id
      AND (c.criado_por = auth.uid()
        OR public.has_role(auth.uid(),'admin'::public.app_role)
        OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wa_campanhas c
    WHERE c.id = campanha_id
      AND (c.criado_por = auth.uid()
        OR public.has_role(auth.uid(),'admin'::public.app_role)
        OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  ));

CREATE POLICY "Deletar destinatários acessíveis"
  ON public.wa_campanha_destinatarios FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wa_campanhas c
    WHERE c.id = campanha_id
      AND (c.criado_por = auth.uid()
        OR public.has_role(auth.uid(),'admin'::public.app_role)
        OR public.has_role(auth.uid(),'super_admin'::public.app_role))
  ));

CREATE TRIGGER trg_wa_destinatarios_updated_at
  BEFORE UPDATE ON public.wa_campanha_destinatarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
