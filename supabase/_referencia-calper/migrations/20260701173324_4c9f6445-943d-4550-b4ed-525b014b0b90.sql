
-- Tabela de configuração de integrações (TOTVS RM, DocuSign)
CREATE TABLE IF NOT EXISTS public.wa_integracoes_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  servico TEXT NOT NULL CHECK (servico IN ('totvs_rm', 'docusign')),
  chave TEXT NOT NULL,
  valor TEXT,
  atualizado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (servico, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_integracoes_config TO authenticated;
GRANT ALL ON public.wa_integracoes_config TO service_role;

ALTER TABLE public.wa_integracoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam integrações"
  ON public.wa_integracoes_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins gerenciam integrações"
  ON public.wa_integracoes_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER wa_integracoes_config_updated_at
  BEFORE UPDATE ON public.wa_integracoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.wa_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.wa_auditoria TO authenticated;
GRANT ALL ON public.wa_auditoria TO service_role;

ALTER TABLE public.wa_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam auditoria"
  ON public.wa_auditoria FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Usuários autenticados registram auditoria"
  ON public.wa_auditoria FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS idx_wa_auditoria_created_at ON public.wa_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_auditoria_entidade ON public.wa_auditoria(entidade, entidade_id);
