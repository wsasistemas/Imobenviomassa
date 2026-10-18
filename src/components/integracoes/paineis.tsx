import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Save, Plug, ExternalLink, FileText, Copy, RefreshCw, Building2, Users, Pencil } from "lucide-react";
import {
  ROTULO_RECURSO_RM,
  salvarCredenciaisRm,
  statusIntegracaoRm,
  testarConexaoRm,
  type RecursoRm,
  type StatusRm,
  type TesteConexaoRm,
} from "@/lib/integracoes/totvs.functions";
import {
  carregarConfigDocusign,
  salvarConfigDocusign,
  testarConexaoDocusign,
  listarTemplatesDocusign,
  obterUrlConsentimentoDocusign,
  type DocusignConfigPublic,
  type TestarConexaoDocusignResult,
  type TemplateDocusign,
} from "@/lib/integracoes/docusign.functions";
import { DocusignGuide } from "@/components/integracoes/docusign-guide";
import { PageHead } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";

const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR") : "nunca");
const ICONE_RM: Record<RecursoRm, typeof Building2> = { empreendimentos: Building2, compradores: Users };
const EXEMPLO_ENDPOINT: Record<RecursoRm, string> = {
  empreendimentos: "http://servidor-do-rm:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/API.00.09.002/0/X",
  compradores: "http://servidor-do-rm:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/API.00.09.001/0/X",
};

/** Integrações com o TOTVS RM — mesmo modelo do Portal DP: usuário/senha comuns, um endpoint por integração. */
export function TotvsForm() {
  const carregarStatus = useServerFn(statusIntegracaoRm);
  const gravar = useServerFn(salvarCredenciaisRm);
  const testar = useServerFn(testarConexaoRm);
  const [status, setStatus] = useState<StatusRm[] | null | undefined>(undefined);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [form, setForm] = useState<{ recurso: RecursoRm; endpoint: string; usuario: string; senha: string } | null>(null);
  const [ocupado, setOcupado] = useState<RecursoRm | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [testes, setTestes] = useState<Partial<Record<RecursoRm, TesteConexaoRm>>>({});

  const recarregar = useCallback(async () => {
    try {
      const r = await carregarStatus();
      setStatus(r.status);
      setSuperAdmin(r.superAdmin);
      setAviso(null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    }
  }, [carregarStatus]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function salvar() {
    if (!form) return;
    setAviso(null);
    setOcupado(form.recurso);
    try {
      await gravar({ data: form });
      setForm(null);
      await recarregar();
      toast.success("Credenciais gravadas", { description: "Use \"Testar conexão\" para conferir." });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  }

  async function executarTeste(recurso: RecursoRm) {
    setOcupado(recurso);
    setTestes((t) => ({ ...t, [recurso]: undefined }));
    try {
      const r = await testar({ data: { recurso } });
      setTestes((t) => ({ ...t, [recurso]: r }));
      if (r.ok) await recarregar();
    } catch (e) {
      setTestes((t) => ({ ...t, [recurso]: { ok: false, msg: e instanceof Error ? e.message : String(e) } }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title="Integrações TOTVS RM"
        actions={
          <Button variant="outline" size="sm" onClick={() => void recarregar()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
        }
      >
        Consultas ao TOTVS RM usadas no Novo Disparo: a lista de empreendimentos e os compradores de cada um. O
        usuário e a senha são os mesmos para todas as integrações; o endpoint é de cada uma. As credenciais ficam no
        banco, num schema privado, e a senha nunca volta para a tela.
      </PageHead>

      {aviso && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {status === undefined && !aviso && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {status === null && (
        <div className="rounded-lg border border-[#e2c37c] bg-warning-soft px-3 py-2.5 text-[12.5px] text-[#8a5c14]">
          As integrações ainda não estão disponíveis no banco. Rode a migração{" "}
          <code>20260929120000_rm_credenciais_privado.sql</code> no Supabase.
        </div>
      )}

      {status?.map((s) => {
        const Icone = ICONE_RM[s.recurso];
        const editando = form?.recurso === s.recurso;
        const teste = testes[s.recurso];
        return (
          <Card key={s.recurso}>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="flex items-center gap-2 text-[15px] font-bold">
                  <Icone className="h-4 w-4 text-primary" /> {ROTULO_RECURSO_RM[s.recurso]}
                </h3>
                <p className="mt-1 text-[12.5px] leading-normal text-muted-foreground">
                  {s.configurado ? `Endpoint cadastrado (usuário ${s.usuario})` : "Endpoint ainda não cadastrado"} · última
                  consulta: {dataHora(s.ultimaConsulta)}
                  {s.atualizadoPor ? ` · alterado por ${s.atualizadoPor} em ${dataHora(s.atualizadoEm)}` : ""}
                </p>
                {s.endpoint && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{s.endpoint}</p>}
                {s.recurso === "compradores" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    O código do empreendimento escolhido entra automaticamente em{" "}
                    <code>?parameters=CODCOLIGADA=…</code>.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void executarTeste(s.recurso)} disabled={!s.configurado || ocupado !== null}>
                  {ocupado === s.recurso && !editando ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plug className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Testar conexão
                </Button>
                {superAdmin && !editando && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ recurso: s.recurso, endpoint: s.endpoint, usuario: s.usuario, senha: "" })}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {s.configurado ? "Alterar credenciais" : "Cadastrar credenciais"}
                  </Button>
                )}
              </div>

              {!superAdmin && (
                <p className="text-xs text-muted-foreground">Só um Super Admin cadastra ou troca as credenciais do TOTVS RM.</p>
              )}

              {teste && (
                <Alert variant={teste.ok ? "default" : "destructive"}>
                  {teste.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4" />}
                  <AlertDescription>
                    <span>{teste.msg}</span>
                    {teste.campos && teste.campos.length > 0 && (
                      <span className="mt-1 block break-all font-mono text-xs opacity-80">
                        Campos retornados: {teste.campos.join(", ")}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {editando && form && (
                <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={"ep-" + s.recurso}>Endpoint desta integração (URL completa)</Label>
                    <Input
                      id={"ep-" + s.recurso}
                      type="url"
                      className="font-mono text-xs"
                      placeholder={EXEMPLO_ENDPOINT[s.recurso]}
                      value={form.endpoint}
                      onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={"us-" + s.recurso}>Usuário</Label>
                    <Input id={"us-" + s.recurso} value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={"se-" + s.recurso}>Senha</Label>
                    <Input
                      id={"se-" + s.recurso}
                      type="password"
                      autoComplete="new-password"
                      placeholder={s.usuario ? "deixe em branco para manter a atual" : ""}
                      value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                    O usuário e a senha são os mesmos para todas as integrações do RM; o endpoint é de cada uma. As
                    credenciais ficam no banco, num schema privado que a API pública do Supabase não enxerga, e a senha
                    nunca volta para esta tela.
                  </p>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button size="sm" onClick={() => void salvar()} disabled={ocupado !== null}>
                      {ocupado === s.recurso ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Salvar credenciais
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setForm(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// DocuSign
// ============================================================

const DOCUSIGN_ENDPOINTS: { label: string; method: "GET" | "POST"; path: string; hint?: string }[] = [
  { label: "Obter Access Token (JWT)", method: "POST", path: "{auth_url}/oauth/token", hint: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" },
  { label: "Listar templates", method: "GET", path: "{base_url}/accounts/{account_id}/templates?shared=false" },
  { label: "Detalhes do template", method: "GET", path: "{base_url}/accounts/{account_id}/templates/{template_id}" },
  { label: "Papéis (roles)", method: "GET", path: "{base_url}/accounts/{account_id}/templates/{template_id}/recipients" },
  { label: "Documentos do template", method: "GET", path: "{base_url}/accounts/{account_id}/templates/{template_id}/documents" },
  { label: "Preview em iframe", method: "POST", path: "{base_url}/accounts/{account_id}/templates/{template_id}/views/recipient_preview" },
  { label: "Criar/enviar envelope", method: "POST", path: "{base_url}/accounts/{account_id}/envelopes" },
  { label: "Status do envelope", method: "GET", path: "{base_url}/accounts/{account_id}/envelopes/{envelope_id}" },
  { label: "Destinatários do envelope", method: "GET", path: "{base_url}/accounts/{account_id}/envelopes/{envelope_id}/recipients" },
];

type DocusignForm = {
  id?: string;
  ambiente: "demo" | "producao";
  base_url: string;
  auth_url: string;
  account_id: string;
  integration_key: string;
  impersonated_user_id: string;
  default_template_id: string;
  rsa_private_key: string;
  webhook_secret: string;
  rsa_configurada: boolean;
  webhook_configurado: boolean;
  ativo: boolean;
};

const DOCUSIGN_EMPTY: DocusignForm = {
  ambiente: "demo",
  base_url: "https://demo.docusign.net/restapi/v2.1",
  auth_url: "https://account-d.docusign.com",
  account_id: "",
  integration_key: "",
  impersonated_user_id: "",
  default_template_id: "",
  rsa_private_key: "",
  webhook_secret: "",
  rsa_configurada: false,
  webhook_configurado: false,
  ativo: true,
};

function mapDocusignPublic(data: DocusignConfigPublic): DocusignForm {
  return {
    id: data.id,
    ambiente: data.ambiente,
    base_url: data.base_url,
    auth_url: data.auth_url,
    account_id: data.account_id,
    integration_key: data.integration_key,
    impersonated_user_id: data.impersonated_user_id,
    default_template_id: data.default_template_id,
    rsa_private_key: "",
    webhook_secret: "",
    rsa_configurada: data.rsa_private_key_configurada,
    webhook_configurado: data.webhook_secret_configurado,
    ativo: data.ativo,
  };
}

export function DocusignForm() {
  const [cfg, setCfg] = useState<DocusignForm>(DOCUSIGN_EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<null | TestarConexaoDocusignResult>(null);
  const [templates, setTemplates] = useState<TemplateDocusign[]>([]);
  const [loadingTpls, setLoadingTpls] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  const { pode } = useCurrentUser();
  const podeAlterar = pode("credenciais");
  const loadConfig = useServerFn(carregarConfigDocusign);
  const saveConfig = useServerFn(salvarConfigDocusign);
  const runTeste = useServerFn(testarConexaoDocusign);
  const runListar = useServerFn(listarTemplatesDocusign);
  const runConsent = useServerFn(obterUrlConsentimentoDocusign);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await loadConfig();
        setCfg(mapDocusignPublic(data));
      } catch (error) {
        toast.error("Não foi possível carregar DocuSign", {
          description: error instanceof Error ? error.message : "Falha desconhecida",
        });
      }
      setLoading(false);
    })();
  }, [loadConfig]);

  const update = (k: keyof DocusignForm, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v as never }));

  function onAmbienteChange(next: "demo" | "producao") {
    setCfg((c) => ({
      ...c,
      ambiente: next,
      base_url: next === "producao" ? "https://na1.docusign.net/restapi/v2.1" : "https://demo.docusign.net/restapi/v2.1",
      auth_url: next === "producao" ? "https://account.docusign.com" : "https://account-d.docusign.com",
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = await saveConfig({
        data: {
          id: cfg.id,
          ambiente: cfg.ambiente,
          base_url: cfg.base_url.trim(),
          auth_url: cfg.auth_url.trim(),
          account_id: cfg.account_id.trim(),
          integration_key: cfg.integration_key.trim(),
          impersonated_user_id: cfg.impersonated_user_id.trim(),
          rsa_private_key: cfg.rsa_private_key,
          default_template_id: cfg.default_template_id.trim(),
          webhook_secret: cfg.webhook_secret,
          ativo: cfg.ativo,
        },
      });
      setCfg(mapDocusignPublic(data));
      setShowKey(false);
      setShowSecret(false);
      toast.success("Configurações DocuSign salvas");
      // A auditoria é gravada pelo servidor em salvarConfigDocusign (com IP).
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : "Falha desconhecida",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await runTeste();
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Falha desconhecida" });
    } finally {
      setTesting(false);
    }
  }

  async function handleListar() {
    setLoadingTpls(true);
    setTplError(null);
    try {
      const res = await runListar();
      setTemplates(res.templates);
      if (res.error) setTplError(res.error);
    } catch (e) {
      setTplError(e instanceof Error ? e.message : "Falha ao listar templates");
    } finally {
      setLoadingTpls(false);
    }
  }

  async function handleConsent() {
    try {
      const res = await runConsent();
      if (!res.url) {
        toast.error("Preencha Integration Key e Auth URL antes de gerar a URL de consentimento.");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar URL de consentimento");
    }
  }

  const copyEndpoint = (path: string) => {
    const resolved = path
      .replace("{base_url}", cfg.base_url)
      .replace("{auth_url}", cfg.auth_url)
      .replace("{account_id}", cfg.account_id || "{account_id}")
      .replace("{template_id}", cfg.default_template_id || "{template_id}");
    navigator.clipboard.writeText(resolved).then(
      () => toast.success("Endpoint copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Configurações DocuSign</CardTitle>
            <CardDescription>
              Credenciais JWT + endpoints reais para autenticação, listagem de templates e envio de envelopes.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            <DocusignGuide
              ambiente={cfg.ambiente}
              onAmbienteChange={onAmbienteChange}
              checks={{
                account_id: !!cfg.account_id.trim(),
                integration_key: !!cfg.integration_key.trim(),
                impersonated_user_id: !!cfg.impersonated_user_id.trim(),
                rsa: cfg.rsa_configurada || !!cfg.rsa_private_key,
                consent: !!testResult?.ok && !testResult?.consentRequired,
                tested: !!testResult?.ok,
              }}
            />
            {/* Ambiente */}
            <div className="space-y-2">

              <Label>Ambiente</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={cfg.ambiente === "demo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAmbienteChange("demo")}
                >
                  Demo (sandbox)
                </Button>
                <Button
                  type="button"
                  variant={cfg.ambiente === "producao" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAmbienteChange("producao")}
                >
                  Produção
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Alternar o ambiente preenche automaticamente <code>base_url</code> e <code>auth_url</code>.
              </p>
            </div>

            {/* URLs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-base">Base URL (REST)</Label>
                <Input id="ds-base" value={cfg.base_url} onChange={(e) => update("base_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-auth">Auth URL (OAuth)</Label>
                <Input id="ds-auth" value={cfg.auth_url} onChange={(e) => update("auth_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-acc">Account ID</Label>
                <Input id="ds-acc" value={cfg.account_id} onChange={(e) => update("account_id", e.target.value)} placeholder="GUID da conta" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-ikey">Integration Key (Client ID)</Label>
                <Input id="ds-ikey" value={cfg.integration_key} onChange={(e) => update("integration_key", e.target.value)} placeholder="GUID do app JWT" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-uid">Impersonated User ID</Label>
                <Input id="ds-uid" value={cfg.impersonated_user_id} onChange={(e) => update("impersonated_user_id", e.target.value)} placeholder="GUID do usuário impersonado" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-tpl">Template padrão (opcional)</Label>
                <Input id="ds-tpl" value={cfg.default_template_id} onChange={(e) => update("default_template_id", e.target.value)} placeholder="templateId sugerido no wizard" />
              </div>
            </div>

            {/* RSA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ds-rsa">Chave RSA privada (PKCS#8)</Label>
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Ocultar</span>
                  ) : (
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Mostrar</span>
                  )}
                </button>
              </div>
              <Textarea
                id="ds-rsa"
                rows={6}
                className="font-mono text-xs"
                value={showKey ? cfg.rsa_private_key : (cfg.rsa_private_key ? cfg.rsa_private_key : "")}
                onChange={(e) => update("rsa_private_key", e.target.value)}
                placeholder={cfg.rsa_configurada && !cfg.rsa_private_key
                  ? "Chave já configurada — cole novamente apenas para trocar"
                  : "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
              />
              <p className="text-xs text-muted-foreground">
                Cole no formato PKCS#8 (linha inicial <code>-----BEGIN PRIVATE KEY-----</code>). Nunca é retornada ao navegador depois de salva.
              </p>
            </div>

            {/* Webhook Connect */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ds-hook">Webhook secret (Connect HMAC)</Label>
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? (
                    <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Ocultar</span>
                  ) : (
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Mostrar</span>
                  )}
                </button>
              </div>
              <Input
                id="ds-hook"
                type={showSecret ? "text" : "password"}
                value={cfg.webhook_secret}
                onChange={(e) => update("webhook_secret", e.target.value)}
                placeholder={cfg.webhook_configurado ? "Segredo já configurado — digite apenas para trocar" : "Chave HMAC usada para validar callbacks Connect"}
              />
            </div>

            {/* Diagnóstico */}
            {testResult && (
              <Alert variant={testResult.ok ? "default" : "destructive"}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4" />}
                <AlertDescription>
                  <span>{testResult.msg}</span>
                  {typeof testResult.status === "number" && (
                    <span className="mt-1 block font-mono text-xs opacity-80">Status HTTP: {testResult.status}</span>
                  )}
                  {testResult.accountName && (
                    <span className="mt-1 block text-xs opacity-90">
                      Conta: <b>{testResult.accountName}</b> ({testResult.accountId})
                    </span>
                  )}
                  {typeof testResult.expiresIn === "number" && (
                    <span className="mt-1 block text-xs opacity-80">Token válido por {testResult.expiresIn}s</span>
                  )}
                  {testResult.consentRequired && testResult.consentUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => window.open(testResult.consentUrl!, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Abrir URL de consentimento
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving || !podeAlterar} title={podeAlterar ? undefined : "Só um Super Admin altera as credenciais do DocuSign"}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testar conexão
              </Button>
              <Button variant="outline" onClick={handleConsent}>
                <ExternalLink className="mr-2 h-4 w-4" />
                URL de consentimento
              </Button>
              <Button variant="outline" onClick={handleListar} disabled={loadingTpls}>
                {loadingTpls ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Listar templates
              </Button>
            </div>

            {/* Templates */}
            {(templates.length > 0 || tplError) && (
              <div className="space-y-2 pt-2">
                <Label>Templates da conta</Label>
                {tplError && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{tplError}</AlertDescription>
                  </Alert>
                )}
                {templates.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map((t) => (
                      <div key={t.templateId} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">{t.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <code className="truncate">{t.templateId}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1"
                            onClick={() => {
                              navigator.clipboard.writeText(t.templateId);
                              toast.success("Template ID copiado");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1"
                            onClick={() => update("default_template_id", t.templateId)}
                          >
                            Definir como padrão
                          </Button>
                        </div>
                        {t.lastModified && (
                          <div className="text-[10px] text-muted-foreground">
                            Modificado em {new Date(t.lastModified).toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Endpoints de referência */}
            <div className="space-y-2 pt-4">
              <Label>Endpoints oficiais</Label>
              <div className="space-y-1 rounded-lg border p-3">
                {DOCUSIGN_ENDPOINTS.map((ep) => (
                  <div key={ep.label} className="flex items-start gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={
                        ep.method === "GET"
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-primary/40 bg-primary/10 text-primary"
                      }
                    >
                      {ep.method}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{ep.label}</div>
                      <code className="block truncate font-mono text-[11px] text-muted-foreground">{ep.path}</code>
                      {ep.hint && <div className="text-[10px] text-muted-foreground">{ep.hint}</div>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1"
                      onClick={() => copyEndpoint(ep.path)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Webhook (DocuSign Connect): configure o callback público em <code>/api/public/docusign/connect</code> após publicar o app.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


