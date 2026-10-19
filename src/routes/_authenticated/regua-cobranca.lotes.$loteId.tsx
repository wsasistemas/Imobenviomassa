import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { Selo, SemAcesso } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Aviso,
  Contador,
  SeloBoleto,
  SeloLote,
  SeloRegua,
  SeloTentativa,
} from "@/components/regua/ui";
import { exportarExcel, exportarPdf } from "@/components/regua/exportar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cancelarLote, processarLote, reenviarFalhas } from "@/lib/regua/lote.functions";
import { dadosExportacaoLote, detalheLote, trilhaBoleto } from "@/lib/regua/regua.functions";
import {
  dataBr,
  dataHoraBr,
  descreverFiltro,
  moeda,
  reguaDoLote,
  type FiltroCampo,
} from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/regua-cobranca/lotes/$loteId")({
  validateSearch: z.object({ processar: z.boolean().optional() }),
  component: DetalheLotePage,
});

type Filtro = "todos" | "sucesso" | "falhas" | "excecoes" | "andamento";

function DetalheLotePage() {
  const { loteId } = Route.useParams();
  const { processar: autoIniciar } = Route.useSearch();
  const { podeAcessar, loading } = useCurrentUser();
  const qc = useQueryClient();
  const carregar = useServerFn(detalheLote);
  const processar = useServerFn(processarLote);
  const cancelar = useServerFn(cancelarLote);
  const reenviar = useServerFn(reenviarFalhas);
  const exportar = useServerFn(dadosExportacaoLote);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [trilha, setTrilha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const parar = useRef(false);

  const pode = podeAcessar("regua_auditoria_ver") || podeAcessar("regua_lote_criar");
  const {
    data: d,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["regua-lote", loteId, filtro, busca, pagina],
    queryFn: () => carregar({ data: { loteId, filtro, busca: busca || null, pagina } }),
    enabled: !loading && pode,
    placeholderData: (a) => a,
    refetchInterval: (q) =>
      q.state.data?.lote.status === "em_processamento" ? (enviando ? 3000 : 6000) : false,
  });

  // Envio em sequência enquanto a tela está aberta (padrão do Disparo DocuSign): cada chamada manda poucas mensagens.
  async function iniciarEnvio() {
    if (enviando) return;
    parar.current = false;
    setEnviando(true);
    try {
      for (let i = 0; i < 2000 && !parar.current; i++) {
        const r = await processar({ data: { loteId } });
        if (r.terminou) {
          toast.success(
            r.status === "concluido"
              ? "Lote concluído."
              : r.status === "cancelado"
                ? "Lote cancelado."
                : "Lote concluído com falhas. Confira as exceções e falhas.",
          );
          break;
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "O envio parou por um erro.");
    } finally {
      setEnviando(false);
      await qc.invalidateQueries({ queryKey: ["regua-lote", loteId] });
      await qc.invalidateQueries({ queryKey: ["regua-lotes"] });
    }
  }

  const iniciou = useRef(false);
  useEffect(() => {
    if (!iniciou.current && autoIniciar && d?.lote.status === "em_processamento" && d.podeAcionar) {
      iniciou.current = true;
      void iniciarEnvio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIniciar, d?.lote.status, d?.podeAcionar]);
  useEffect(() => () => void (parar.current = true), []);

  async function acao(nome: string, fn: () => Promise<unknown>, ok: string, depois?: () => void) {
    setOcupado(nome);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["regua-lote", loteId] });
      depois?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(null);
    }
  }

  async function baixar(tipo: "xlsx" | "pdf") {
    setOcupado(tipo);
    try {
      const dados = await exportar({ data: { loteId } });
      if (tipo === "xlsx") await exportarExcel(dados);
      else await exportarPdf(dados);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setOcupado(null);
    }
  }

  if (loading) return null;
  if (!pode) return <SemAcesso texto="Seu perfil não vê os lotes da Régua de Cobrança." />;
  if (error)
    return (
      <Aviso tom="danger">
        {error instanceof Error ? error.message : "Não foi possível carregar o lote."}
      </Aviso>
    );
  if (isLoading || !d) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando o lote…
      </div>
    );
  }

  const { lote: l, contadores: c } = d;
  const fila = c.whatsapp.fila + c.email.fila;
  const temFalha = c.whatsapp.falhas + c.email.falhas > 0;
  const pct = c.elegiveis ? Math.round(((c.elegiveis - c.processando) / c.elegiveis) * 100) : 100;

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/regua-cobranca/lotes"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Lotes
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-extrabold tracking-[-0.02em]">
            {l.titulo} <SeloLote s={l.status} />
            {l.tipo === "extraordinario" && <Selo tom="danger">Extraordinário</Selo>}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Lote #{l.numero} ·{" "}
            {l.iniciadoEm
              ? `acionado por ${l.usuario ?? "—"} em ${dataHoraBr(l.iniciadoEm)}`
              : `rascunho de ${l.usuario ?? "—"}`}{" "}
            · {l.origem === "rm" ? "TOTVS RM" : "planilha"} ·{" "}
            <SeloRegua r={reguaDoLote(l.tipoRegua, l.faixa)} /> · templates:{" "}
            {[
              l.templateWhatsapp && `WhatsApp ${l.templateWhatsapp}`,
              l.templateEmail && `e-mail ${l.templateEmail}`,
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
          {l.faixa === "personalizada" && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Faixa personalizada: {l.filtros.diasMin ?? 1}
              {l.filtros.diasMax != null ? ` a ${l.filtros.diasMax}` : " ou mais"} dias de atraso
            </p>
          )}
          {l.filtros.campos.length > 0 && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Filtros por campo:{" "}
              {l.filtros.campos.map((f) => descreverFiltro(f as FiltroCampo)).join(" · ")}
            </p>
          )}
          {l.observacao && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Obs.: {l.observacao}</p>
          )}
          {l.justificativa && (
            <p className="mt-0.5 text-[12.5px] text-primary-dark">
              Justificativa do extraordinário: {l.justificativa}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!!ocupado}
            onClick={() => void baixar("xlsx")}
          >
            {ocupado === "xlsx" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!!ocupado}
            onClick={() => void baixar("pdf")}
          >
            {ocupado === "pdf" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            PDF
          </Button>
          {d.podeAcionar && temFalha && l.status !== "cancelado" && l.status !== "rascunho" && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!ocupado || enviando}
              onClick={() =>
                acao(
                  "reenviar",
                  () => reenviar({ data: { loteId } }),
                  "Falhas na fila de reenvio.",
                  () => void iniciarEnvio(),
                )
              }
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reenviar todas as falhas
            </Button>
          )}
          {d.podeAcionar && l.status === "rascunho" && (
            <Button asChild size="sm">
              <Link to="/regua-cobranca/novo" search={{ lote: l.id }}>
                Revisar e acionar
              </Link>
            </Button>
          )}
          {d.podeAcionar && (l.status === "em_processamento" || l.status === "rascunho") && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!ocupado}
              onClick={() => {
                if (!window.confirm("Cancelar o lote? O que ainda não saiu não será enviado."))
                  return;
                parar.current = true;
                void acao("cancelar", () => cancelar({ data: { loteId } }), "Lote cancelado.");
              }}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancelar lote
            </Button>
          )}
        </div>
      </div>

      {l.status === "em_processamento" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card">
          <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-muted">
            <i
              className={cn("block h-full bg-primary transition-all", enviando && "animate-pulse")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[13px] tabular-nums">
            {c.elegiveis - c.processando} de {c.elegiveis} boletos · {fila} mensagens na fila
          </span>
          {d.podeAcionar &&
            (enviando ? (
              <Button size="sm" variant="outline" onClick={() => (parar.current = true)}>
                <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar envio
              </Button>
            ) : (
              <Button size="sm" onClick={() => void iniciarEnvio()}>
                <Play className="mr-1.5 h-3.5 w-3.5" /> {fila ? "Continuar envio" : "Concluir"}
              </Button>
            ))}
          <span className="w-full text-[11.5px] text-muted-foreground">
            {enviando
              ? "Enviando… mantenha esta tela aberta. Se fechar, o lote continua de onde parou ao abrir de novo."
              : "Envio pausado. Clique em Continuar envio para seguir."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
        <Contador valor={c.no_lote} rotulo="No lote" />
        <Contador valor={c.nao_registrados} rotulo="Não registrados" tom="danger" />
        <Contador valor={c.sem_contato} rotulo="Sem contato válido" tom="warning" />
        <Contador valor={c.elegiveis} rotulo="Elegíveis" />
        <Contador
          valor={`${c.sucesso}${c.elegiveis ? ` (${Math.round((c.sucesso / c.elegiveis) * 100)}%)` : ""}`}
          rotulo="Sucesso"
          tom="success"
        />
        <Contador valor={c.falhas} rotulo="Falhas" tom="danger" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {l.canais.includes("whatsapp") && (
          <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
            <h2 className="flex items-center gap-2 text-[16px] font-bold">
              <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {c.whatsapp.enviados} enviados · {c.whatsapp.entregues} entregues ·{" "}
              {c.whatsapp.lidos ?? 0} lidos · {c.whatsapp.falhas} falhas
              {c.whatsapp.bloqueados ? ` · ${c.whatsapp.bloqueados} na trava 24 h` : ""}
              {c.whatsapp.fila ? ` · ${c.whatsapp.fila} na fila` : ""}
            </p>
          </section>
        )}
        {l.canais.includes("email") && (
          <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
            <h2 className="flex items-center gap-2 text-[16px] font-bold">
              <Mail className="h-4 w-4 text-info" /> E-mail
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {c.email.enviados} enviados · {c.email.entregues} entregues · {c.email.falhas} falhas
              {c.email.bloqueados ? ` · ${c.email.bloqueados} na trava 24 h` : ""}
              {c.email.fila ? ` · ${c.email.fila} na fila` : ""}
            </p>
          </section>
        )}
      </div>

      <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-bold">Boletos</h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
                placeholder="Cliente ou boleto"
                className="h-8 w-[180px] pl-7"
              />
            </div>
            <div className="inline-flex overflow-hidden rounded-[9px] border border-border-strong">
              {(
                [
                  ["todos", "Todos"],
                  ["sucesso", "Sucesso"],
                  ["falhas", "Falhas"],
                  ["excecoes", "Exceções"],
                  ["andamento", "Na fila"],
                ] as const
              ).map(([id, r]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFiltro(id);
                    setPagina(0);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-[12.5px] font-semibold",
                    filtro === id ? "bg-foreground text-white" : "text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Boleto</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>PDF</TableHead>
                {l.canais.includes("whatsapp") && <TableHead>WhatsApp</TableHead>}
                {l.canais.includes("email") && <TableHead>E-mail</TableHead>}
                <TableHead>Resultado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.linhas.map((b) => (
                <TableRow key={b.id} className={cn(b.status === "falha" && "bg-primary-soft/50")}>
                  <TableCell>
                    <b>{b.cliente}</b>
                    <div className="font-mono text-[11.5px] text-muted-foreground">
                      {b.documento}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[12px]">{b.numero}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {dataBr(b.vencimento)}
                    {b.diasAtraso != null && b.diasAtraso > 0 && (
                      <div className="text-[11px] text-muted-foreground">{b.diasAtraso} dias</div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{moeda(b.valor)}</TableCell>
                  <TableCell>
                    {b.pdf === "gerado" ? (
                      <Selo tom="success">Gerado</Selo>
                    ) : b.pdf === "removido" ? (
                      <Selo>Expirado</Selo>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  {l.canais.includes("whatsapp") && (
                    <TableCell>
                      <CelulaCanal
                        t={b.whatsapp}
                        podeReenviar={d.podeAcionar && !enviando}
                        onReenviar={(id) =>
                          acao(
                            `r-${id}`,
                            () => reenviar({ data: { loteId, tentativaId: id } }),
                            "Reenvio na fila.",
                            () => void iniciarEnvio(),
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {l.canais.includes("email") && (
                    <TableCell>
                      <CelulaCanal
                        t={b.email}
                        podeReenviar={d.podeAcionar && !enviando}
                        onReenviar={(id) =>
                          acao(
                            `r-${id}`,
                            () => reenviar({ data: { loteId, tentativaId: id } }),
                            "Reenvio na fila.",
                            () => void iniciarEnvio(),
                          )
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <SeloBoleto s={b.status} />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="whitespace-nowrap text-[12px] font-bold text-primary"
                      onClick={() => setTrilha(b.id)}
                    >
                      Ver trilha
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            Mostrando {d.linhas.length} de {d.total}
          </span>
          {d.total > d.porPagina && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={pagina === 0}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(pagina + 1) * d.porPagina >= d.total}
                onClick={() => setPagina(pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      </section>

      <TrilhaSheet boletoId={trilha} onClose={() => setTrilha(null)} />
    </div>
  );
}

function CelulaCanal({
  t,
  podeReenviar,
  onReenviar,
}: {
  t: {
    status: import("@/lib/regua/comum").StatusTentativa;
    tentativaId: string;
    erro: string | null;
  } | null;
  podeReenviar: boolean;
  onReenviar: (id: string) => void;
}) {
  if (!t) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-start gap-0.5" title={t.erro ?? undefined}>
      <SeloTentativa s={t.status} />
      {t.status === "falha" && podeReenviar && (
        <button
          type="button"
          className="text-[11px] font-bold text-primary"
          onClick={() => onReenviar(t.tentativaId)}
        >
          Reenviar
        </button>
      )}
    </div>
  );
}

function TrilhaSheet({ boletoId, onClose }: { boletoId: string | null; onClose: () => void }) {
  const carregar = useServerFn(trilhaBoleto);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["regua-trilha", boletoId],
    queryFn: () => carregar({ data: { boletoId: boletoId! } }),
    enabled: !!boletoId,
  });
  const cor = {
    ok: "bg-success",
    falha: "bg-primary",
    info: "bg-info",
    aviso: "bg-warning",
  } as const;
  return (
    <Sheet open={!!boletoId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>Trilha do boleto {data?.boleto.numero ?? ""}</SheetTitle>
          <SheetDescription>
            {data
              ? `${data.boleto.cliente} · ${data.boleto.documento} · ${data.boleto.empreendimento ?? ""} ${data.boleto.unidade ?? ""} · ${moeda(data.boleto.valor)}`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>
        {error && (
          <Aviso tom="danger">
            {error instanceof Error ? error.message : "Não foi possível carregar a trilha."}
          </Aviso>
        )}
        {isLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        <ol className="mt-5 flex flex-col">
          {(data?.eventos ?? []).map((e, i) => (
            <li key={i} className="relative grid grid-cols-[18px_1fr] gap-3 pb-4">
              {i < (data?.eventos.length ?? 0) - 1 && (
                <span className="absolute left-[8px] top-5 bottom-0 w-0.5 bg-border" />
              )}
              <span
                className={cn(
                  "mt-1 h-[18px] w-[18px] rounded-full border-4 border-card ring-1 ring-border",
                  cor[e.tipo],
                )}
              />
              <div className="min-w-0">
                <b className="block text-[13px]">{e.titulo}</b>
                <small className="text-[11.5px] text-muted-foreground">
                  {dataHoraBr(e.em)}
                  {e.detalhe ? ` · ${e.detalhe}` : ""}
                </small>
                {(e.payload || e.resposta) && (
                  <div className="mt-1">
                    <button
                      type="button"
                      className="text-[11.5px] font-bold text-primary"
                      onClick={() => setAberto(aberto === `${i}` ? null : `${i}`)}
                    >
                      {aberto === `${i}` ? "Esconder payload e resposta" : "Ver payload e resposta"}
                    </button>
                    {aberto === `${i}` && (
                      <pre className="mt-1.5 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg bg-secondary px-2.5 py-2 font-mono text-[10.5px] leading-snug">
                        {e.payload ? `// enviado\n${e.payload}\n` : ""}
                        {e.resposta ? `// resposta do provedor\n${e.resposta}` : ""}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
