import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { refreshEnvelopesCampanha, reenviarEnvelopeDocusign } from "@/lib/integracoes/docusign.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Eye, EyeOff, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { baixarCsv } from "@/lib/csv";
import { contatosDaCampanha, exportarRelatorioCsv, type ContatosCampanha } from "@/lib/relatorios.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Database } from "@/integrations/supabase/types";
import { DEST_STATUS_LABEL, getStatusAssinatura, getStatusAssinaturaSimples, STATUS_SIMPLES_LABEL, STATUS_SIMPLES_VARIANT, type StatusAssinaturaSimples } from "@/lib/relatorios/status";

type Campanha = Database["imobenviomassa"]["Tables"]["wa_campanhas"]["Row"];
// LGPD: o navegador NÃO lê cpf, telefone, email nem dados_extras desta tabela (GRANT por coluna, migração
// 20261001190000). Telefone e e-mail vêm de `contatosDaCampanha` (servidor, mascarados por padrão); o CPF
// não é carregado em lugar nenhum desta tela. Também não se lê o JSON bruto do DocuSign (`raw`).
type Destinatario = Omit<
  Database["imobenviomassa"]["Tables"]["wa_campanha_destinatarios"]["Row"],
  "cpf" | "telefone" | "email" | "dados_extras" | "anonimizado_em"
> & {
  anonimizado_em?: string | null;
};
type Envelope = Omit<Database["imobenviomassa"]["Tables"]["docusign_envelopes"]["Row"], "raw">;

const COLUNAS_DESTINATARIO =
  "id, campanha_id, nome, empreendimento, bloco, unidade, status, envelope_docusign_id, enviado_em, assinado_em, erro_msg, created_at, updated_at, anonimizado_em";
const COLUNAS_ENVELOPE =
  "id, campanha_id, destinatario_id, envelope_id, template_id, status, sent_at, completed_at, declined_at, voided_at, last_event_at, created_at";

const AVISO_CSV_COMPLETO =
  "O arquivo completo contém CPF, telefone e e-mail dos compradores (dados pessoais protegidos pela LGPD).\n\n" +
  "Use-o apenas para a finalidade da campanha e guarde com segurança. Esta exportação será registrada na auditoria.\n\n" +
  "Deseja continuar?";

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number) {
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function Kpi({
  label,
  value,
  sub,
  tone,
  selected,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "destructive";
  selected?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`
        transition-colors
        ${clickable ? "cursor-pointer hover:border-primary/60 hover:bg-primary/5" : ""}
        ${selected ? "border-primary ring-1 ring-primary bg-primary/5" : ""}
      `}
    >
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function RelatorioDetalheHeaderInfo({ campanhaId }: { campanhaId: string }) {
  const { data } = useQuery({
    queryKey: ["relatorio_detalhe", campanhaId],
    enabled: false,
  });
  const camp = (data as { campanha: Campanha | null } | undefined)?.campanha;
  if (!camp) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Modelo: {camp.modelo_docusign_nome ?? "—"} · Criada em {formatDate(camp.created_at)}
    </p>
  );
}

export interface RelatorioDetalheViewProps {
  campanhaId: string;
  onCampanhaLoaded?: (camp: Campanha | null) => void;
}

export function RelatorioDetalheView({ campanhaId, onCampanhaLoaded }: RelatorioDetalheViewProps) {
  const [busca, setBusca] = useState("");
  const [blocoFiltro, setBlocoFiltro] = useState("");
  const [unidadeFiltro, setUnidadeFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusAssinaturaSimples | "todos">("todos");
  const queryClient = useQueryClient();
  const { nivel } = useCurrentUser();
  // Só a interface: o servidor confere o papel de novo em exportarRelatorioCsv.
  const podeExportarCompleto = nivel === "admin" || nivel === "superadmin";
  const refreshFn = useServerFn(refreshEnvelopesCampanha);
  const reenviarFn = useServerFn(reenviarEnvelopeDocusign);
  const exportarFn = useServerFn(exportarRelatorioCsv);
  const contatosFn = useServerFn(contatosDaCampanha);

  // Contatos (telefone/e-mail) vêm do servidor, MASCARADOS por padrão (chave com revelado = false).
  const contatosMascarados = useQuery({
    queryKey: ["relatorio_contatos", campanhaId, false],
    queryFn: () => contatosFn({ data: { campanhaId, revelar: false } }),
    staleTime: 5 * 60_000,
  });
  // "Mostrar contatos": pede os valores completos (o servidor audita cada pedido, `contatos_revelados`).
  // É uma ação explícita, por isso mutation (um clique = uma auditoria), e não query com cache. O
  // resultado só vale para a campanha em que foi pedido: ao trocar de campanha volta a mascarar.
  const [reveladosState, setRevelados] = useState<{ campanhaId: string; contatos: ContatosCampanha["contatos"] } | null>(null);
  const reveladosAtuais = reveladosState?.campanhaId === campanhaId ? reveladosState.contatos : null;
  useEffect(() => {
    setRevelados(null);
  }, [campanhaId]);
  const revelarMutation = useMutation({
    mutationFn: (id: string) => contatosFn({ data: { campanhaId: id, revelar: true } }),
    onSuccess: (res, id) => setRevelados({ campanhaId: id, contatos: res.contatos }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível mostrar os contatos"),
  });
  // O que está na tela: completos só depois de revelados; senão, mascarados.
  const contatos = reveladosAtuais ?? contatosMascarados.data?.contatos ?? {};
  const mostrarContatos = reveladosAtuais !== null;

  // O CSV é gerado e auditado no servidor; aqui só se baixa o texto pronto.
  const exportarMutation = useMutation({
    mutationFn: (completo: boolean) =>
      exportarFn({
        data: {
          campanhaId,
          completo,
          statusFiltro: statusFiltro === "todos" ? undefined : statusFiltro,
          busca: busca.trim() || undefined,
          blocoFiltro: blocoFiltro.trim() || undefined,
          unidadeFiltro: unidadeFiltro.trim() || undefined,
        },
      }),
    onSuccess: (res, completo) => {
      baixarCsv(res.nome, res.csv);
      toast.success(`CSV ${completo ? "completo " : ""}gerado: ${res.linhas} linha(s)`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao exportar o CSV"),
  });
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const reenviarMutation = useMutation({
    mutationFn: (destinatarioId: string) => reenviarFn({ data: { destinatarioId } }),
    onMutate: (id: string) => setReenviandoId(id),
    onSuccess: async () => {
      toast.success("Envelope reenviado");
      await queryClient.invalidateQueries({ queryKey: ["relatorio_detalhe", campanhaId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reenviar envelope"),
    onSettled: () => setReenviandoId(null),
  });
  const autoRefreshed = useRef<string | null>(null);

  const manualRef = useRef(false);
  const refreshMutation = useMutation({
    mutationFn: () => refreshFn({ data: { campanhaId } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["relatorio_detalhe", campanhaId] });
      await queryClient.invalidateQueries({ queryKey: ["relatorios_campanhas"] });
      if (manualRef.current && res && (res.atualizados > 0 || res.erros > 0)) {
        toast.success(`Status atualizado (${res.atualizados}/${res.total})${res.erros ? ` · ${res.erros} erro(s)` : ""}`);
      }
      manualRef.current = false;
    },
    onError: (e) => {
      if (manualRef.current) toast.error(e instanceof Error ? e.message : "Falha ao atualizar status");
      manualRef.current = false;
    },
  });

  // Kick imediato ao abrir a campanha.
  useEffect(() => {
    if (autoRefreshed.current === campanhaId) return;
    autoRefreshed.current = campanhaId;
    manualRef.current = false;
    refreshMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanhaId]);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio_detalhe", campanhaId],
    queryFn: async () => {
      const [campRes, destRes, envRes] = await Promise.all([
        supabase.from("wa_campanhas").select("*").eq("id", campanhaId).maybeSingle(),
        supabase
          .from("wa_campanha_destinatarios")
          .select(COLUNAS_DESTINATARIO)
          .eq("campanha_id", campanhaId)
          .order("created_at", { ascending: true })
          .limit(2000),
        supabase
          .from("docusign_envelopes")
          .select(COLUNAS_ENVELOPE)
          .eq("campanha_id", campanhaId)
          .limit(2000),
      ]);
      if (campRes.error) throw campRes.error;
      if (destRes.error) throw destRes.error;
      if (envRes.error) throw envRes.error;
      const result = {
        campanha: campRes.data as Campanha | null,
        destinatarios: (destRes.data ?? []) as unknown as Destinatario[],
        envelopes: (envRes.data ?? []) as unknown as Envelope[],
      };
      onCampanhaLoaded?.(result.campanha);
      return result;
    },
  });

  const envelopePorId = useMemo(() => {
    const map = new Map<string, Envelope>();
    for (const e of data?.envelopes ?? []) map.set(e.envelope_id, e);
    return map;
  }, [data?.envelopes]);

  const linhas = useMemo(() => {
    const dests = data?.destinatarios ?? [];
    return dests.map((d) => {
      const env = d.envelope_docusign_id ? envelopePorId.get(d.envelope_docusign_id) : undefined;
      const statusAssinatura = getStatusAssinatura(d, env);
      const statusSimples = getStatusAssinaturaSimples(d, env);
      return {
        ...d,
        ...statusAssinatura,
        statusSimples,
        envelope: env,
      };
    });
  }, [data?.destinatarios, envelopePorId]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const b = blocoFiltro.trim().toLowerCase();
    const u = unidadeFiltro.trim().toLowerCase();
    return linhas.filter((l) => {
      if (statusFiltro !== "todos" && l.statusSimples !== statusFiltro) return false;
      if (b && !(l.bloco ?? "").toLowerCase().includes(b)) return false;
      if (u && !(l.unidade ?? "").toLowerCase().includes(u)) return false;
      if (!t) return true;
      // Busca só no que a tela tem: nome, empreendimento, bloco, unidade e os contatos exibidos
      // (mascarados ou revelados). O CPF não é carregado, então não há busca por CPF (de propósito, LGPD).
      const c = contatos[l.id];
      return (
        l.nome.toLowerCase().includes(t) ||
        (l.empreendimento ?? "").toLowerCase().includes(t) ||
        (l.bloco ?? "").toLowerCase().includes(t) ||
        (l.unidade ?? "").toLowerCase().includes(t) ||
        (c?.telefone ?? "").toLowerCase().includes(t) ||
        (c?.email ?? "").toLowerCase().includes(t)
      );
    });
  }, [linhas, busca, blocoFiltro, unidadeFiltro, statusFiltro, contatos]);

  const kpis = useMemo(() => {
    const total = linhas.length;
    let enviados = 0, entregues = 0, assinados = 0, pendentes = 0, erros = 0;
    let somaTempo = 0, countTempo = 0;
    for (const l of linhas) {
      if (l.status === "enviado") enviados++;
      if (l.status === "entregue") entregues++;
      if (l.statusSimples === "assinado") assinados++;
      if (l.statusSimples === "pendente") pendentes++;
      if (l.statusSimples === "cancelado") erros++;
      if (l.enviado_em && l.assinado_em) {
        somaTempo += new Date(l.assinado_em).getTime() - new Date(l.enviado_em).getTime();
        countTempo++;
      }
    }
    const tempoMedioMs = countTempo ? somaTempo / countTempo : 0;
    return {
      total, enviados, entregues, assinados, pendentes, erros,
      taxa: total ? Math.round((assinados / total) * 100) : 0,
      tempoMedio: tempoMedioMs ? formatDuration(tempoMedioMs) : "—",
    };
  }, [linhas]);

  // Polling automático a cada 30s enquanto houver envelopes pendentes.
  const hasPendentes = useMemo(
    () => linhas.some((l) => l.envelope_docusign_id && l.statusSimples === "pendente"),
    [linhas],
  );
  useEffect(() => {
    if (!hasPendentes) return;
    const id = setInterval(() => {
      if (!refreshMutation.isPending) {
        manualRef.current = false;
        refreshMutation.mutate();
      }
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendentes, campanhaId]);

  // CSV gerado no servidor (mascarado por padrão; o completo, só Admin, com aviso e auditoria).
  const exportar = (completo: boolean) => {
    if (completo && !window.confirm(AVISO_CSV_COMPLETO)) return;
    exportarMutation.mutate(completo);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {refreshMutation.isPending && (
          <span className="text-xs text-muted-foreground">Atualizando status…</span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => { manualRef.current = true; refreshMutation.mutate(); }}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Atualizar status
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (mostrarContatos ? setRevelados(null) : revelarMutation.mutate(campanhaId))}
          disabled={revelarMutation.isPending}
          title={mostrarContatos ? "Voltar a mascarar telefone e e-mail" : "Exibe telefone e e-mail completos (a ação é registrada na auditoria)"}
        >
          {mostrarContatos ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {mostrarContatos ? "Ocultar contatos" : "Mostrar contatos"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportar(false)}
          disabled={!filtradas.length || exportarMutation.isPending}
          title="CSV com CPF, telefone e e-mail mascarados"
        >
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
        {podeExportarCompleto && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportar(true)}
            disabled={!filtradas.length || exportarMutation.isPending}
            title="Contém dados pessoais completos; a exportação é registrada na auditoria"
          >
            <ShieldAlert className="mr-2 h-4 w-4" /> Exportar CSV completo (CPF e contatos)
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total" value={kpis.total} selected={statusFiltro === "todos"} onClick={() => setStatusFiltro("todos")} />
        <Kpi label="Assinados" value={kpis.assinados} selected={statusFiltro === "assinado"} onClick={() => setStatusFiltro("assinado")} />
        <Kpi label="Pendentes" value={kpis.pendentes} selected={statusFiltro === "pendente"} onClick={() => setStatusFiltro("pendente")} />
        <Kpi label="Cancelados" value={kpis.erros} tone={kpis.erros ? "destructive" : undefined} selected={statusFiltro === "cancelado"} onClick={() => setStatusFiltro("cancelado")} />
        <Kpi label="Taxa assinatura" value={`${kpis.taxa}%`} selected={statusFiltro === "assinado"} onClick={() => setStatusFiltro("assinado")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, empreendimento, bloco, unidade ou contato exibido" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Input className="w-[120px]" placeholder="Bloco" value={blocoFiltro} onChange={(e) => setBlocoFiltro(e.target.value)} />
        <Input className="w-[120px]" placeholder="Unidade" value={unidadeFiltro} onChange={(e) => setUnidadeFiltro(e.target.value)} />
        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusAssinaturaSimples | "todos")}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_SIMPLES_LABEL) as StatusAssinaturaSimples[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_SIMPLES_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatário</TableHead>
              <TableHead>Bloco</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Assinado</TableHead>
              <TableHead className="w-[110px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum destinatário encontrado.</TableCell></TableRow>
            ) : filtradas.map((l) => {
              const podeReenviar = l.statusSimples === "pendente" && !!l.envelope_docusign_id;
              const carregando = reenviandoId === l.id && reenviarMutation.isPending;
              return (
              <TableRow key={l.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.nome}</span>
                    {l.anonimizado_em && (
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground" title="Dados pessoais eliminados (LGPD)">
                        dados anonimizados
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contatos[l.id]?.telefone ?? contatos[l.id]?.email ?? (contatosMascarados.isLoading ? "…" : "—")}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{l.bloco ?? "—"}</TableCell>
                <TableCell className="text-xs">{l.unidade ?? "—"}</TableCell>
                <TableCell>
                  {l.status === "opt_out" ? (
                    <Badge variant="outline" title={l.erro_msg ?? undefined}>{DEST_STATUS_LABEL.opt_out}</Badge>
                  ) : (
                    <Badge variant={STATUS_SIMPLES_VARIANT[l.statusSimples]}>{STATUS_SIMPLES_LABEL[l.statusSimples]}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(l.enviado_em)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(l.assinado_em)}</TableCell>
                <TableCell className="text-right">
                  {podeReenviar ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reenviarMutation.mutate(l.id)}
                      disabled={carregando || reenviarMutation.isPending}
                      title="Reenviar notificação pelo mesmo canal"
                    >
                      {carregando
                        ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        : <Send className="mr-2 h-3.5 w-3.5" />}
                      Reenviar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
