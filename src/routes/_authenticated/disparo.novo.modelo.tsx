import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizardStore, type ModeloDocusign } from "@/stores/wizard-store";
import {
  gerarPreviewTemplateDocusign,
  listarModelosDocusign,
} from "@/lib/integracoes/docusign.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ExternalLink, FileText, Loader2, AlertCircle, Eye, MessageSquare, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    DocuSign?: {
      loadDocuSign: (integrationKey: string) => Promise<{
        signing: (config: {
          url: string;
          displayFormat: "focused" | "default";
          style?: Record<string, unknown>;
        }) => {
          mount: (containerSelectString: string) => void;
          on: (eventName: "ready" | "sessionEnd", cb: (event: unknown) => void) => void;
        };
      }>;
    };
  }
}

const DOCUSIGN_CONTAINER_ID = "docusign-preview-container";

function carregarScriptDocusign(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Não foi possível carregar o DocuSign JS.")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.docusignJs = "true";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("Não foi possível carregar o DocuSign JS.")), { once: true });
    document.head.appendChild(script);
  });
}

export const Route = createFileRoute("/_authenticated/disparo/novo/modelo")({
  component: EtapaModelo,
});

function EtapaModelo() {
  const navigate = useNavigate();
  const modelo = useWizardStore((s) => s.modelo);
  const setModelo = useWizardStore((s) => s.setModelo);
  const canais = useWizardStore((s) => s.canais);
  const setCanais = useWizardStore((s) => s.setCanais);
  const compradores = useWizardStore((s) => s.compradores);
  const [modelos, setModelos] = useState<ModeloDocusign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewModelo, setPreviewModelo] = useState<ModeloDocusign | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIntegrationKey, setPreviewIntegrationKey] = useState<string | null>(null);
  const [previewDocusignJsUrl, setPreviewDocusignJsUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFrameAviso, setPreviewFrameAviso] = useState(false);
  const docusignContainerRef = useRef<HTMLDivElement | null>(null);
  const listarModelos = useServerFn(listarModelosDocusign);
  const gerarPreview = useServerFn(gerarPreviewTemplateDocusign);

  useEffect(() => {
    (async () => {
      try {
        const res = await listarModelos();
        setModelos(res.modelos);
        if (res.error) setError(res.error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!previewUrl || !previewIntegrationKey || !previewDocusignJsUrl || !previewModelo) return;

    let cancelled = false;
    let ready = false;
    const container = docusignContainerRef.current;
    if (container) container.innerHTML = "";

    (async () => {
      try {
        setPreviewLoading(true);
        setPreviewFrameAviso(false);
        await carregarScriptDocusign(previewDocusignJsUrl);
        if (cancelled) return;
        if (!window.DocuSign?.loadDocuSign) {
          throw new Error("DocuSign JS carregou, mas a API de incorporação não está disponível.");
        }
        const docusign = await window.DocuSign.loadDocuSign(previewIntegrationKey);
        if (cancelled) return;
        const signing = docusign.signing({
          url: previewUrl,
          displayFormat: "focused",
          style: {
            signingNavigationButton: {
              finishText: "Concluir",
              position: "bottom-right",
            },
          },
        });
        signing.on("ready", () => {
          if (!cancelled) {
            ready = true;
            setPreviewLoading(false);
            setPreviewFrameAviso(false);
          }
        });
        signing.on("sessionEnd", () => {
          if (!cancelled) setPreviewLoading(false);
        });
        signing.mount(`#${DOCUSIGN_CONTAINER_ID}`);
        window.setTimeout(() => {
          if (!cancelled && !ready) {
            setPreviewLoading(false);
            setPreviewFrameAviso(true);
          }
        }, 7_000);
      } catch (e) {
        if (!cancelled) {
          setPreviewLoading(false);
          setPreviewFrameAviso(true);
          setPreviewError(e instanceof Error ? e.message : "Erro ao montar preview DocuSign.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [previewDocusignJsUrl, previewIntegrationKey, previewModelo, previewUrl]);


  async function abrirPreview(m: ModeloDocusign) {
    setPreviewModelo(m);
    setPreviewUrl(null);
    setPreviewIntegrationKey(null);
    setPreviewDocusignJsUrl(null);
    setPreviewError(null);
    setPreviewFrameAviso(false);
    setPreviewLoading(true);
    let manterLoadingParaMount = false;
    try {
      const appOrigin = window.location.origin;
      const parentOrigin = window.location.ancestorOrigins?.[0] ?? appOrigin;
      const frameAncestors = [appOrigin, parentOrigin].filter(
        (origin, index, origins) => origins.indexOf(origin) === index,
      );
      const res = await gerarPreview({
        data: {
          templateId: m.id,
          returnUrl: appOrigin,
          allowFromUrl: appOrigin,
          frameAncestors,
          messageOrigins: frameAncestors,
        },
      });
      if (res.error || !res.url) {
        setPreviewError(res.error ?? "Não foi possível gerar o preview deste modelo.");
      } else {
        setPreviewUrl(res.url);
        setPreviewIntegrationKey(res.integrationKey ?? null);
        setPreviewDocusignJsUrl(res.docusignJsUrl ?? null);
        manterLoadingParaMount = Boolean(res.integrationKey && res.docusignJsUrl);
        if (!res.integrationKey || !res.docusignJsUrl) {
          setPreviewError("DocuSign retornou a URL, mas não retornou os dados necessários para montar o preview embutido.");
        }
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Erro ao gerar preview");
    } finally {
      if (!manterLoadingParaMount) setPreviewLoading(false);
    }
  }

  function fecharPreview() {
    setPreviewModelo(null);
    setPreviewUrl(null);
    setPreviewIntegrationKey(null);
    setPreviewDocusignJsUrl(null);
    setPreviewError(null);
    setPreviewFrameAviso(false);
    setPreviewLoading(false);
    if (docusignContainerRef.current) docusignContainerRef.current.innerHTML = "";
  }

  function usarModeloSelecionado() {
    if (previewModelo) setModelo(previewModelo);
    fecharPreview();
  }

  return (
    <StepShell
      title="Modelo DocuSign"
      description="Selecione um modelo e, se desejar, visualize o preview antes de confirmar."
      prevPath="/disparo/novo/compradores"
      onNext={() => navigate({ to: "/disparo/novo/verificacao" })}
      nextDisabled={!modelo}
    >
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando modelos…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {modelos.map((m) => {
            const selected = modelo?.id === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setModelo(m)}
                className={cn(
                  "relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-primary/40 hover:bg-muted/40 cursor-pointer",
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {selected && (
                      <Badge variant="default" className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Selecionado
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirPreview(m);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      Preview
                    </Button>
                  </div>
                </div>
                <div className="mt-3 font-medium">{m.nome}</div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {m.descricao}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {m.papeis.map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Canais de envio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Escolha como os destinatários serão notificados.
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={canais}
            onValueChange={(v) => setCanais(v as "whatsapp" | "email" | "ambos")}
            className="grid gap-3 sm:grid-cols-3"
          >
            {[
              { value: "whatsapp", label: "WhatsApp", desc: "Envia notificação por WhatsApp", Icon: MessageSquare },
              { value: "email", label: "E-mail", desc: "Envia apenas por e-mail", Icon: Mail },
              { value: "ambos", label: "Ambos", desc: "WhatsApp + e-mail", Icon: Send },
            ].map(({ value, label, desc, Icon }) => {
              const selected = canais === value;
              return (
                <Label
                  key={value}
                  htmlFor={`canal-${value}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={value} id={`canal-${value}`} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>




      <Dialog open={!!previewModelo} onOpenChange={(o) => !o && fecharPreview()}>
        <DialogContent className="flex h-[92vh] max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[92vw]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewModelo?.nome ?? "Preview do modelo"}
            </DialogTitle>
            <DialogDescription>
              Preview oficial do destinatário no DocuSign. Clique em "Usar este modelo" para selecioná-lo.
            </DialogDescription>
          </DialogHeader>

          <div className="relative min-h-0 flex-1 bg-muted/30">
            {previewError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div className="font-medium">Não foi possível gerar o preview</div>
                <div className="text-xs">{previewError}</div>
                {previewUrl && (
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Abrir em nova aba
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div
                  id={DOCUSIGN_CONTAINER_ID}
                  ref={docusignContainerRef}
                  className="absolute inset-0 h-full w-full bg-background [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
                />
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando preview…
                  </div>
                )}
                {previewFrameAviso && !previewLoading && (
                  <div className="absolute inset-x-4 top-4 rounded-md border bg-background/95 p-4 text-sm shadow-sm backdrop-blur">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="space-y-2">
                        <div className="font-medium">O navegador pode ter bloqueado o preview embutido.</div>
                        <div className="text-muted-foreground">
                          Isso pode acontecer por restrições de iframe do navegador. Se necessário, abra o preview em uma nova aba.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 items-center gap-2 border-t bg-background px-6 py-3 sm:justify-between">
            {previewUrl && !previewError ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Abrir em nova aba
                </a>
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={fecharPreview}>
                Fechar
              </Button>
              <Button onClick={usarModeloSelecionado} disabled={!previewModelo}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Usar este modelo
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StepShell>
  );
}
