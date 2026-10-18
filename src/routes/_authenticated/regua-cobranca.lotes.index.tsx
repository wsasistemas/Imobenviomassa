import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search } from "lucide-react";
import { PageHead, Selo, SemAcesso } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Aviso, SeloLote, SeloRegua, Vazio } from "@/components/regua/ui";
import { reguaDoLote } from "@/lib/regua/comum";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listarLotes } from "@/lib/regua/regua.functions";
import { dataHoraBr, type StatusLote } from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/regua-cobranca/lotes/")({
  component: LotesPage,
});

const FILTROS: [StatusLote | "", string][] = [
  ["", "Todos"],
  ["rascunho", "Rascunho"],
  ["em_processamento", "Em processamento"],
  ["concluido", "Concluído"],
  ["concluido_com_falhas", "Com falhas"],
  ["cancelado", "Cancelado"],
];

function LotesPage() {
  const { podeAcessar, loading } = useCurrentUser();
  const listar = useServerFn(listarLotes);
  const [status, setStatus] = useState<StatusLote | "">("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["regua-lotes", status, busca, pagina],
    queryFn: () => listar({ data: { status: status || null, busca: busca || null, pagina } }),
    enabled: !loading && (podeAcessar("regua_auditoria_ver") || podeAcessar("regua_lote_criar")),
    // Andamento "em tempo real": atualiza enquanto houver lote em processamento na tela.
    refetchInterval: (q) =>
      q.state.data?.lotes.some((l) => l.status === "em_processamento") ? 4000 : false,
    placeholderData: (a) => a,
  });

  if (loading) return null;
  if (!podeAcessar("regua_auditoria_ver") && !podeAcessar("regua_lote_criar"))
    return <SemAcesso texto="Seu perfil não vê os lotes da Régua de Cobrança." />;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title="Lotes"
        actions={
          data?.podeCriar && (
            <Button asChild size="sm">
              <Link to="/regua-cobranca/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Novo lote
              </Link>
            </Button>
          )
        }
      >
        Todos os lotes da régua, com o andamento em tempo real.
      </PageHead>
      <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar por título, nº do lote ou usuário"
              className="w-[280px] pl-7"
            />
          </div>
          <div className="inline-flex overflow-x-auto rounded-[9px] border border-border-strong">
            {FILTROS.map(([id, r]) => (
              <button
                key={id || "todos"}
                type="button"
                onClick={() => {
                  setStatus(id);
                  setPagina(0);
                }}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 text-[12.5px] font-semibold",
                  status === id ? "bg-foreground text-white" : "text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        {error && (
          <Aviso tom="danger">
            {error instanceof Error ? error.message : "Não foi possível carregar os lotes."}
          </Aviso>
        )}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !data?.lotes.length ? (
          <Vazio titulo="Nenhum lote encontrado">Monte o primeiro em Novo lote.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Título da remessa</TableHead>
                  <TableHead>Régua</TableHead>
                  <TableHead>Acionado em</TableHead>
                  <TableHead>Por</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Boletos</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lotes.map((l) => {
                  const fila = (l.contadores.whatsapp?.fila ?? 0) + (l.contadores.email?.fila ?? 0);
                  const elegiveis = l.contadores.elegiveis ?? 0;
                  const feitos = Math.max(0, elegiveis - (l.contadores.processando ?? 0));
                  const pct = elegiveis ? Math.round((feitos / elegiveis) * 100) : 0;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-bold">#{l.numero}</TableCell>
                      <TableCell>
                        <span className="font-semibold">{l.titulo}</span>
                        {l.tipo === "extraordinario" && (
                          <span className="ml-1.5">
                            <Selo tom="danger">Extraordinário</Selo>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <SeloRegua r={reguaDoLote(l.tipoRegua, l.faixa)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {l.iniciadoEm ? dataHoraBr(l.iniciadoEm) : "—"}
                      </TableCell>
                      <TableCell>{l.usuario ?? "—"}</TableCell>
                      <TableCell>{l.origem === "rm" ? "TOTVS RM" : "Planilha"}</TableCell>
                      <TableCell className="tabular-nums">{l.contadores.no_lote ?? "—"}</TableCell>
                      <TableCell>
                        {l.status === "rascunho" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2 text-[12px]">
                            <div className="h-1.5 w-[110px] overflow-hidden rounded-full bg-muted">
                              <i
                                className={cn(
                                  "block h-full",
                                  l.status === "em_processamento"
                                    ? "animate-pulse bg-primary"
                                    : "bg-primary",
                                )}
                                style={{ width: `${l.status === "em_processamento" ? pct : 100}%` }}
                              />
                            </div>
                            <span className="tabular-nums">
                              {l.status === "em_processamento"
                                ? `${feitos}/${elegiveis}${fila ? ` · ${fila} na fila` : ""}`
                                : `${elegiveis}/${elegiveis}`}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <SeloLote s={l.status} />
                      </TableCell>
                      <TableCell>
                        {l.status === "rascunho" ? (
                          <Link
                            to="/regua-cobranca/novo"
                            search={{ lote: l.id }}
                            className="text-[12px] font-bold text-primary"
                          >
                            Continuar
                          </Link>
                        ) : (
                          <Link
                            to="/regua-cobranca/lotes/$loteId"
                            params={{ loteId: l.id }}
                            className="text-[12px] font-bold text-primary"
                          >
                            Abrir
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 flex justify-end gap-1.5">
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
            disabled={(data?.lotes.length ?? 0) < 30}
            onClick={() => setPagina(pagina + 1)}
          >
            Próxima
          </Button>
        </div>
      </section>
    </div>
  );
}
