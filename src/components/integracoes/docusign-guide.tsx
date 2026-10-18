import * as React from "react";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
  KeyRound,
  ListChecks,
  ShieldCheck,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { docusignAdminUrl, type DocusignAmbiente } from "@/lib/integracoes/docusign-urls";

type GuideProps = {
  ambiente: DocusignAmbiente;
  onAmbienteChange: (a: DocusignAmbiente) => void;
  checks: {
    account_id: boolean;
    integration_key: boolean;
    impersonated_user_id: boolean;
    rsa: boolean;
    consent: boolean;
    tested: boolean;
  };
};

type StepDef = {
  id: keyof GuideProps["checks"] | "ambiente";
  title: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  breadcrumb: string;
  adminPath?: string;
  fieldId?: string;
  body: React.ReactNode;
  illustration: React.ReactNode;
};

const STORAGE_KEY = "wa.docusign.guide.hidden";

export function DocusignGuide({ ambiente, onAmbienteChange, checks }: GuideProps) {
  const [hidden, setHidden] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggleHidden(next: boolean) {
    setHidden(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  const steps: StepDef[] = [
    {
      id: "ambiente",
      title: "1. Escolha o ambiente",
      short: "Ambiente",
      icon: Sparkles,
      breadcrumb: "DocuSign › Ambiente",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Comece em <b>Demo</b> (sandbox) para validar o fluxo sem custo. Só troque para{" "}
            <b>Produção</b> depois de tudo funcionando.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={ambiente === "demo" ? "default" : "outline"}
              onClick={() => onAmbienteChange("demo")}
            >
              Usar Demo
            </Button>
            <Button
              size="sm"
              variant={ambiente === "producao" ? "default" : "outline"}
              onClick={() => onAmbienteChange("producao")}
            >
              Usar Produção
            </Button>
          </div>
          <Callout tone="info">
            Alternar preenche automaticamente <code>base_url</code> e <code>auth_url</code>.
          </Callout>
        </div>
      ),
      illustration: <IllustrationEnv ambiente={ambiente} />,
    },
    {
      id: "account_id",
      title: "2. Account ID + Integration Key",
      short: "App & Chave",
      icon: KeyRound,
      breadcrumb: "Settings › Apps and Keys",
      adminPath: "/apps-and-keys",
      fieldId: "ds-acc",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No painel DocuSign, entre em <b>Settings → Apps and Keys</b>. Copie:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <b>API Account ID</b> (GUID no topo da página) → cole em{" "}
                <FieldTag id="ds-acc">Account ID</FieldTag>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <b>Integration Key</b> do seu app → cole em{" "}
                <FieldTag id="ds-ikey">Integration Key</FieldTag>
              </span>
            </li>
          </ul>
          <Callout tone="warn">
            A Integration Key precisa estar <b>Enabled</b> com autenticação{" "}
            <b>JWT (Service Integration)</b> habilitada.
          </Callout>
        </div>
      ),
      illustration: <IllustrationAppsKeys />,
    },
    {
      id: "impersonated_user_id",
      title: "3. Usuário impersonado (API Username)",
      short: "Usuário",
      icon: UserCog,
      breadcrumb: "Settings › Users › (usuário) › API Username",
      adminPath: "/users",
      fieldId: "ds-uid",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Vá em <b>Settings → Users</b>, abra o usuário que assinará via API (normalmente um{" "}
            usuário de serviço) e copie o <b>API Username</b> — é um GUID, não o e-mail.
          </p>
          <Callout tone="warn">
            Nunca cole o e-mail aqui. O campo espera o <b>GUID</b> do usuário.
          </Callout>
          <p className="text-xs text-muted-foreground">
            Cole em <FieldTag id="ds-uid">Impersonated User ID</FieldTag>.
          </p>
        </div>
      ),
      illustration: <IllustrationUser />,
    },
    {
      id: "rsa",
      title: "4. Chave RSA privada",
      short: "RSA",
      icon: ShieldCheck,
      breadcrumb: "Apps and Keys › sua integração › Actions › RSA Keypairs",
      adminPath: "/apps-and-keys",
      fieldId: "ds-rsa",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Em <b>Apps and Keys</b>, abra sua integração e clique em{" "}
            <b>Actions → RSA Keypairs → Add RSA Keypair</b>. Copie a <b>chave privada</b> inteira
            (com <code>BEGIN</code>/<code>END</code>) e cole em{" "}
            <FieldTag id="ds-rsa">Chave RSA privada</FieldTag>.
          </p>
          <Callout tone="ok">
            Aceitamos PKCS#1 (<code>BEGIN RSA PRIVATE KEY</code>) e PKCS#8 (
            <code>BEGIN PRIVATE KEY</code>).
          </Callout>
          <Callout tone="warn">
            A pública fica registrada no DocuSign. A privada nunca é retornada ao navegador depois
            de salva.
          </Callout>
        </div>
      ),
      illustration: <IllustrationRSA />,
    },
    {
      id: "consent",
      title: "5. Autorizar o app (consent)",
      short: "Consent",
      icon: Eye,
      breadcrumb: "Fluxo OAuth JWT · uma única vez por usuário",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Na primeira chamada JWT, o DocuSign responde <code>consent_required</code>. Clique em{" "}
            <b>Testar conexão</b> abaixo. Se aparecer esse erro, use o botão{" "}
            <b>URL de consentimento</b> para abrir a página de autorização em outra aba, aceite, e
            teste de novo.
          </p>
          <Callout tone="info">
            Escopos usados: <code>signature</code> e <code>impersonation</code>.
          </Callout>
        </div>
      ),
      illustration: <IllustrationConsent />,
    },
    {
      id: "tested",
      title: "6. Testar e listar templates",
      short: "Testar",
      icon: ListChecks,
      breadcrumb: "Configurações DocuSign › Ações",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Clique em <b>Testar conexão</b> — deve mostrar nome da conta e tempo de vida do token.
            Depois clique em <b>Listar templates</b> para carregar os modelos disponíveis e, se
            quiser, definir um como padrão do wizard.
          </p>
          <Callout tone="info">
            Webhook secret é opcional — só preencha se for configurar <b>DocuSign Connect</b> em{" "}
            <b>Settings → Connect</b>.
          </Callout>
        </div>
      ),
      illustration: <IllustrationTest />,
    },
  ];

  const active = steps[step];
  const done = (id: StepDef["id"]) =>
    id === "ambiente" ? true : checks[id as keyof GuideProps["checks"]];

  if (hidden) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <span>Guia de configuração DocuSign oculto.</span>
        <Button size="sm" variant="ghost" onClick={() => toggleHidden(false)}>
          Mostrar guia
        </Button>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Como configurar em 6 passos</div>
              <div className="text-xs text-muted-foreground">
                Guia visual para preencher todos os campos DocuSign
              </div>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => toggleHidden(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex gap-1 overflow-x-auto border-b bg-background/60 px-3 py-3">
          {steps.map((s, i) => {
            const isDone = done(s.id);
            const isActive = i === step;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={cn(
                  "flex min-w-[110px] flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isDone
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className="max-w-full truncate font-medium">{s.short}</span>
              </button>
            );
          })}
        </div>

        {/* Content grid */}
        <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 text-primary">
                Passo {step + 1} de {steps.length}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {active.breadcrumb}
              </Badge>
            </div>
            <h3 className="text-base font-semibold">{active.title}</h3>
            {active.body}

            <div className="flex flex-wrap gap-2 pt-2">
              {active.adminPath && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      docusignAdminUrl(ambiente, active.adminPath!),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Abrir no DocuSign ({ambiente === "producao" ? "Prod" : "Demo"})
                </Button>
              )}
              {active.fieldId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => focusField(active.fieldId!)}
                >
                  Ir para o campo
                </Button>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  size="sm"
                  disabled={step === steps.length - 1}
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                >
                  Próximo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Illustration + checklist */}
          <div className="border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-center rounded-md border bg-background p-3">
              {active.illustration}
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Checklist
              </div>
              {steps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  {done(s.id) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                  <span className={done(s.id) ? "text-foreground" : "text-muted-foreground"}>
                    {s.short}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  (el as HTMLElement).focus?.({ preventScroll: true });
  el.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-shadow");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
  }, 1600);
}

function FieldTag({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => focusField(id)}
      className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/20"
    >
      {children}
    </button>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "info" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-primary/30 bg-primary/5 text-foreground",
    warn: "border-amber-500/40 bg-amber-500/10 text-black",
    ok: "border-success/40 bg-success/10 text-black",
  }[tone];
  return (
    <div className={cn("rounded-md border px-3 py-2 text-xs", styles)}>{children}</div>
  );
}

/* ----------------------------- Illustrations ----------------------------- */

function IllustrationEnv({ ambiente }: { ambiente: DocusignAmbiente }) {
  const isProd = ambiente === "producao";
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="14" width="96" height="102" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="116" y="14" width="96" height="102" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <text x="56" y="36" textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="600">Demo</text>
      <text x="56" y="52" textAnchor="middle" className="fill-muted-foreground" fontSize="7">account-d.docusign.com</text>
      <text x="164" y="36" textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="600">Produção</text>
      <text x="164" y="52" textAnchor="middle" className="fill-muted-foreground" fontSize="7">account.docusign.com</text>
      <rect
        x={isProd ? 116 : 8}
        y="14"
        width="96"
        height="102"
        rx="8"
        className="fill-primary/10 stroke-primary"
        strokeWidth="2"
      />
      <circle cx={isProd ? 190 : 82} cy="90" r="10" className="fill-primary" />
      <path
        d={isProd ? "M186 90 l3 3 l6 -6" : "M78 90 l3 3 l6 -6"}
        className="stroke-primary-foreground"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IllustrationAppsKeys() {
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="10" width="204" height="110" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="16" y="18" width="60" height="8" rx="2" className="fill-muted-foreground/40" />
      <rect x="16" y="34" width="188" height="30" rx="4" className="fill-background stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="22" y="46" fontSize="7" className="fill-muted-foreground">API Account ID</text>
      <text x="22" y="58" fontSize="8" fontFamily="monospace" className="fill-primary">a1b2c3d4-...-e5f6</text>
      <rect x="16" y="72" width="188" height="30" rx="4" className="fill-background stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="22" y="84" fontSize="7" className="fill-muted-foreground">Integration Key</text>
      <text x="22" y="96" fontSize="8" fontFamily="monospace" className="fill-primary">9f8e7d...-1234</text>
    </svg>
  );
}

function IllustrationUser() {
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="10" width="204" height="110" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <circle cx="40" cy="52" r="16" className="fill-primary/20 stroke-primary" strokeWidth="1.5" />
      <path d="M22 82 Q40 62 58 82 L58 92 L22 92 Z" className="fill-primary/20 stroke-primary" strokeWidth="1.5" />
      <text x="72" y="42" fontSize="8" className="fill-foreground" fontWeight="600">Usuário de serviço</text>
      <text x="72" y="56" fontSize="7" className="fill-muted-foreground">API Username (GUID):</text>
      <rect x="72" y="62" width="132" height="18" rx="3" className="fill-background stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="78" y="74" fontSize="8" fontFamily="monospace" className="fill-primary">3fa85f64-5717-...-0242</text>
      <text x="72" y="98" fontSize="6" className="fill-destructive">✗ e-mail não serve aqui</text>
    </svg>
  );
}

function IllustrationRSA() {
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="10" width="204" height="110" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="16" y="20" width="188" height="90" rx="4" className="fill-background stroke-border" strokeWidth="1" />
      <text x="22" y="34" fontSize="7" fontFamily="monospace" className="fill-muted-foreground">-----BEGIN PRIVATE KEY-----</text>
      <text x="22" y="46" fontSize="7" fontFamily="monospace" className="fill-primary">MIIEvQIBADANBgkqhkiG9w0BAQEFAA</text>
      <text x="22" y="56" fontSize="7" fontFamily="monospace" className="fill-primary">SCBKcwggSjAgEAAoIBAQC7VJTUt9Us</text>
      <text x="22" y="66" fontSize="7" fontFamily="monospace" className="fill-primary">8cKjMzEfYyjiWA4R4/M2bS1GB4t7NX</text>
      <text x="22" y="76" fontSize="7" fontFamily="monospace" className="fill-primary">p98C8SMsdxNsA5x8AOo3f3n8/aN...</text>
      <text x="22" y="88" fontSize="7" fontFamily="monospace" className="fill-muted-foreground">-----END PRIVATE KEY-----</text>
      <rect x="150" y="94" width="52" height="12" rx="6" className="fill-primary" />
      <text x="176" y="103" textAnchor="middle" fontSize="7" className="fill-primary-foreground" fontWeight="700">COPIAR</text>
    </svg>
  );
}

function IllustrationConsent() {
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="10" width="204" height="110" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="20" y="22" width="180" height="14" rx="3" className="fill-background stroke-border" strokeWidth="1" />
      <circle cx="28" cy="29" r="3" className="fill-destructive" />
      <circle cx="36" cy="29" r="3" className="fill-amber-400" />
      <circle cx="44" cy="29" r="3" className="fill-success" />
      <text x="60" y="32" fontSize="7" className="fill-muted-foreground" fontFamily="monospace">account-d.docusign.com/oauth/auth</text>
      <text x="110" y="58" textAnchor="middle" fontSize="9" fontWeight="600" className="fill-foreground">Autorizar aplicação?</text>
      <text x="110" y="72" textAnchor="middle" fontSize="7" className="fill-muted-foreground">signature · impersonation</text>
      <rect x="60" y="82" width="44" height="16" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <text x="82" y="93" textAnchor="middle" fontSize="7" className="fill-foreground">Recusar</text>
      <rect x="116" y="82" width="44" height="16" rx="8" className="fill-primary" />
      <text x="138" y="93" textAnchor="middle" fontSize="7" className="fill-primary-foreground" fontWeight="700">Aceitar</text>
    </svg>
  );
}

function IllustrationTest() {
  return (
    <svg viewBox="0 0 220 130" className="h-28 w-full">
      <rect x="8" y="10" width="204" height="110" rx="8" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="16" y="20" width="188" height="26" rx="4" className="fill-success/15 stroke-success" strokeWidth="1.5" />
      <circle cx="30" cy="33" r="6" className="fill-success" />
      <path d="M27 33 l2 2 l4 -4" strokeWidth="1.5" className="stroke-background" fill="none" strokeLinecap="round" />
      <text x="44" y="30" fontSize="8" fontWeight="600" className="fill-foreground">Conexão OK</text>
      <text x="44" y="41" fontSize="7" className="fill-muted-foreground">Token válido por 3600s</text>
      <text x="20" y="60" fontSize="7" className="fill-muted-foreground" fontWeight="600">Templates disponíveis</text>
      <rect x="16" y="66" width="90" height="24" rx="3" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="114" y="66" width="90" height="24" rx="3" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="16" y="94" width="90" height="18" rx="3" className="fill-background stroke-border" strokeWidth="1" />
      <rect x="114" y="94" width="90" height="18" rx="3" className="fill-background stroke-border" strokeWidth="1" />
      <text x="22" y="79" fontSize="6" fontWeight="600" className="fill-foreground">Contrato Compra</text>
      <text x="120" y="79" fontSize="6" fontWeight="600" className="fill-foreground">Adendo Financiamento</text>
    </svg>
  );
}

