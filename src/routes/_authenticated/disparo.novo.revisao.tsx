import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizardStore } from "@/stores/wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquare, Rocket, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { concluirCampanha, criarCampanha, enviarDestinatarioCampanha } from "@/lib/campanhas.functions";

// O disparo é orquestrado pelo servidor (src/lib/campanhas.functions.ts): esta tela só envia a
// lista revisada, chama o envio destinatário a destinatário para mostrar o progresso e fecha a
// campanha. Validação, limites, template e dono da campanha são conferidos no servidor.

export const Route = createFileRoute("/_authenticated/disparo/novo/revisao")({
  component: EtapaRevisao,
});

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function renderMensagemEnvio(template: string, vars: Omit<Record<string, string>, "link">): string {
  return render(template, { ...vars, link: "" }).replace(/[ \t]+\n/g, "\n").trim();
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>,
  onEach?: (index: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(batchSize, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      onEach?.(i);
    }
  });
  await Promise.all(workers);
  return results;
}

function EtapaRevisao() {
  const navigate = useNavigate();
  const state = useWizardStore();
  const canais = state.canais;
  const enviaWhatsapp = canais === "whatsapp" || canais === "ambos";
  const enviaEmail = canais === "email" || canais === "ambos";
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({
    done: 0,
    total: 0,
    enviados: 0,
    erros: 0,
    atual: "",
    startedAt: 0,
  });
  const criar = useServerFn(criarCampanha);
  const enviarDestinatario = useServerFn(enviarDestinatarioCampanha);
  const concluir = useServerFn(concluirCampanha);

  // Tick para atualizar tempo estimado enquanto envia
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!saving) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [saving]);

  const suporta2Compradores = useMemo(() => {
    const m = state.modelo;
    if (!m) return false;
    const ph = m.placeholders ?? [];
    const papeis = m.papeis ?? [];
    const alvo = `${m.nome ?? ""} ${m.descricao ?? ""}`;
    const rx = /comprador[_\s-]*0?2|comprador[_\s-]*dois|2[º°]?\s*comprador|segundo[_\s-]*comprador|dois\s+ou\s+mais\s+compradores|conjuge|cônjuge/i;
    return (
      rx.test(alvo) ||
      ph.some((p) => rx.test(p)) ||
      papeis.some((p) => rx.test(p)) ||
      papeis.length >= 2
    );
  }, [state.modelo]);

  const isPrincipalRow = (extras: Record<string, unknown>): boolean => {
    const asStr = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
    if (typeof extras.nome_conjuge === "string" && extras.nome_conjuge.trim()) return true;
    return Object.entries(extras).some(([k, v]) => {
      const key = k.toLowerCase();
      const val = asStr(v);
      if (/principal|titular/.test(key)) {
        return val === "" ? false : /^(s|sim|true|1|y|yes|principal|titular)$/.test(val);
      }
      if (/tipo.*(cliente|comprador|pessoa)|papel|fun[cç][aã]o/.test(key)) {
        return /principal|titular/.test(val);
      }
      return false;
    });
  };

  const validos = useMemo(() => {
    const selecionados = state.compradores.filter((c) =>
      state.selecionados.includes(c.id),
    );
    if (suporta2Compradores) return selecionados;
    const principais = selecionados.filter((c) =>
      isPrincipalRow((c.dados_extras ?? {}) as Record<string, unknown>),
    );
    // Fallback: se nenhum marcado como principal, mantém todos (não bloqueia envio)
    return principais.length > 0 ? principais : selecionados;
  }, [state.compradores, state.selecionados, suporta2Compradores]);

  const preview = useMemo(() => {
    const sample = validos[0];
    if (!sample) return state.mensagem_whatsapp;
    return renderMensagemEnvio(state.mensagem_whatsapp, {
      nome: sample.nome,
      empreendimento: sample.empreendimento ?? "",
      unidade: sample.unidade ?? "",
    });
  }, [state.mensagem_whatsapp, validos]);

  const disparar = async () => {
    if (!state.nome.trim()) {
      toast.error("Dê um nome para a campanha no topo do wizard");
      return;
    }
    if (!state.origem || !state.modelo || validos.length === 0) {
      toast.error("Faltam informações obrigatórias");
      return;
    }

    setSaving(true);
    setProgress({ done: 0, total: validos.length, enviados: 0, erros: 0, atual: "", startedAt: Date.now() });

    try {
      // 1) Cria campanha + destinatários no servidor (validação, limites e template conferidos lá)
      const { campanhaId, destinatarios, optOut, optOutNomes } = await criar({
        data: {
          nome: state.nome,
          origem: state.origem,
          filtros_totvs: state.filtros_totvs,
          modelo: { id: state.modelo.id, nome: state.modelo.nome, papeis: state.modelo.papeis ?? [] },
          config_assinatura: state.config_assinatura,
          mensagem_whatsapp: state.mensagem_whatsapp,
          canais,
          destinatarios: validos.map((c) => ({
            nome: c.nome,
            cpf: c.cpf,
            telefone: c.telefone,
            email: c.email,
            empreendimento: c.empreendimento,
            bloco: c.bloco,
            unidade: c.unidade,
            dados_extras: c.dados_extras,
          })),
        },
      });

      // Compradores na lista de descadastro (LGPD) não entram na fila de envio.
      if (optOut > 0) {
        const exibidos = optOutNomes.join(", ");
        toast.warning(`${optOut} comprador(es) na lista de descadastro não receberão o envio`, {
          description: exibidos ? (optOut > optOutNomes.length ? `${exibidos} e outros.` : exibidos) : undefined,
        });
      }
      setProgress((p) => ({ ...p, total: destinatarios.length }));

      // 2) Envia destinatário a destinatário (o servidor monta o envelope e grava o status)
      let enviados = 0;
      let erros = 0;
      await runInBatches(destinatarios, 3, async (d) => {
        setProgress((p) => ({ ...p, atual: d.nome }));
        try {
          const res = await enviarDestinatario({ data: { campanhaId, destinatarioId: d.id } });
          if (res.ok) enviados++;
          else if (!res.optOut) erros++; // descadastrado depois da criação: ignorado, não é erro
        } catch {
          erros++;
        } finally {
          setProgress((p) => ({ ...p, done: p.done + 1, enviados, erros }));
        }
      });

      // 3) Fecha a campanha com os totais recalculados no servidor
      const fim = await concluir({ data: { campanhaId } });

      if (fim.erros === 0) {
        toast.success(
          `Disparo concluído: ${fim.enviados} enviado(s)${fim.optOut > 0 ? `, ${fim.optOut} ignorado(s) por descadastro` : ""}.`,
        );
      } else if (fim.enviados === 0) {
        toast.error(`Falha no disparo: ${fim.erros} erro(s).`);
      } else {
        toast.warning(`Disparo parcial: ${fim.enviados} enviado(s), ${fim.erros} erro(s).`);
      }

      state.reset();
      navigate({ to: "/campanhas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao disparar");
    } finally {
      setSaving(false);
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const elapsedMs = progress.startedAt ? Date.now() - progress.startedAt : 0;
  const avgMs = progress.done > 0 ? elapsedMs / progress.done : 0;
  const remainingMs = avgMs * Math.max(progress.total - progress.done, 0);
  const fmtEta = (ms: number) => {
    if (!ms || !isFinite(ms)) return "—";
    const s = Math.max(1, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}min ${r}s` : `${m}min`;
  };

  return (
    <StepShell
      title={enviaWhatsapp ? "Revisão & mensagem WhatsApp" : "Revisão"}
      description="Confira os dados e dispare os envelopes DocuSign."
      prevPath="/disparo/novo/assinatura"
      onNext={disparar}
      nextLabel={
        saving
          ? progress.total > 0
            ? `Disparando… ${progress.done}/${progress.total}`
            : "Disparando…"
          : "Disparar agora"
      }
      nextDisabled={saving || validos.length === 0}
      loading={saving}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {enviaWhatsapp && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mensagem</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {enviaEmail
                    ? "Este texto será enviado por WhatsApp e por e-mail do DocuSign (mesmo envelope, dois canais)."
                    : "Este texto será enviado por WhatsApp."}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={6}
                  value={state.mensagem_whatsapp}
                  onChange={(e) => state.setMensagem(e.target.value)}
                  disabled={saving}
                  className="font-sans"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Prévia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-[#0b1420] p-4">
                  <div className="max-w-xs rounded-2xl rounded-tl-sm bg-[#005c4b] px-3 py-2 text-sm text-white shadow">
                    {preview}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Info label="Origem" value={state.origem === "totvs" ? "TOTVS RM" : "Planilha Excel"} />
            <Info
              label="Destinatários"
              value={
                suporta2Compradores
                  ? String(validos.length)
                  : `${validos.length} (apenas principais)`
              }
            />
            <Info label="Modelo" value={state.modelo?.nome ?? "—"} />
            <Info
              label="Ordem"
              value={state.config_assinatura.ordem.join(" → ") || "Sem ordem (paralelo)"}
            />
            <Info
              label="2º comprador"
              value={
                !suporta2Compradores
                  ? "Não aplicável (modelo de 1 comprador)"
                  : state.config_assinatura.segundo_comprador === "assina"
                    ? "Assina"
                    : state.config_assinatura.segundo_comprador === "cc"
                      ? "Cópia (CC)"
                      : "Não incluído"
              }
            />
            <Info label="Lembrete" value={`${state.config_assinatura.lembretes_dias} dias`} />
            <Info label="Expira em" value={`${state.config_assinatura.expira_dias} dias`} />
            <Info label="Nome" value={state.nome || "—"} />
            <Info label="Canais" value={canais === "whatsapp" ? "WhatsApp" : canais === "email" ? "E-mail" : "WhatsApp + E-mail"} />

          </CardContent>
        </Card>

        {saving && progress.total > 0 && (
          <div className="lg:col-span-2 fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in">
            <Card className="w-full max-w-lg shadow-2xl animate-scale-in">
              <CardHeader className="items-center text-center space-y-3">
                <div className="relative mx-auto">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Rocket className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-lg">Disparando envelopes</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Não feche esta janela. Enviaremos os documentos via DocuSign e WhatsApp.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-semibold tabular-nums">{progressPct}%</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {progress.done} de {progress.total}
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2.5" />
                </div>


                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border bg-emerald-500/5 px-2 py-3">
                    <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-lg font-semibold tabular-nums">{progress.enviados}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Enviados
                    </div>
                  </div>
                  <div className="rounded-md border bg-destructive/5 px-2 py-3">
                    <div className="flex items-center justify-center gap-1 text-destructive">
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="text-lg font-semibold tabular-nums">{progress.erros}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Erros
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/40 px-2 py-3">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-lg font-semibold tabular-nums">
                        {Math.max(progress.total - progress.done, 0)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Restantes
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Decorrido: {fmtEta(elapsedMs)}</span>
                  <span>Restante estimado: {fmtEta(remainingMs)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </StepShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
