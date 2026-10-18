import { createFileRoute, Link } from "@tanstack/react-router";
import { ComAcesso } from "@/components/page";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3, ExternalLink, Eye, Filter, Search } from "lucide-react";
import { RelatorioDetalheView } from "@/components/relatorios/RelatorioDetalheView";
import { getStatusAssinatura } from "@/lib/relatorios/status";
import type { Database } from "@/integrations/supabase/types";

type Campanha = Database["imobenviomassa"]["Tables"]["wa_campanhas"]["Row"];
type Destinatario = Pick<
  Database["imobenviomassa"]["Tables"]["wa_campanha_destinatarios"]["Row"],
  "id" | "campanha_id" | "status" | "envelope_docusign_id" | "assinado_em" | "updated_at"
>;
type Envelope = Pick<
  Database["imobenviomassa"]["Tables"]["docusign_envelopes"]["Row"],
  "campanha_id" | "envelope_id" | "status" | "sent_at" | "completed_at" | "declined_at" | "voided_at" | "last_event_at"
>;
type CampanhaStatus = Database["imobenviomassa"]["Enums"]["wa_campanha_status"];
type CampanhaOrigem = Database["imobenviomassa"]["Enums"]["wa_campanha_origem"];

type CampanhaComTotais = Campanha & {
  totaisAssinatura: {
    destinatarios: number;
    enviados: number;
    entregues: number;
    assinados: number;
    pendentes: number;
    erros: number;
  };
};

export const Route = createFileRoute("/_authenticated/relatorios/")({
  component: () => (
    <ComAcesso permissao="verRelatorios">
      <RelatoriosPage />
    </ComAcesso>
  ),
});

const STATUS_LABEL: Record<CampanhaStatus, string> = {
  rascunho: "Rascunho",
  rascunho_confirmado: "Aguardando envio",
  em_execucao: "Enviando",
  concluida: "Envio concluído",
  erro: "Falha no envio",
  cancelada: "Envio cancelado",
};

const STATUS_VARIANT: Record<
  CampanhaStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  rascunho: "outline",
  rascunho_confirmado: "secondary",
  em_execucao: "default",
  concluida: "default",
  erro: "destructive",
  cancelada: "outline",
};

const ORIGEM_LABEL: Record<CampanhaOrigem, string> = {
  totvs: "TOTVS RM",
  excel: "Planilha Excel",
};

function formatDate(iso: string) {
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

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function RelatoriosPage() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<CampanhaStatus | "todos">("todos");
  const [origem, setOrigem] = useState<CampanhaOrigem | "todas">("todas");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [aberta, setAberta] = useState<Campanha | null>(null);

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["relatorios_campanhas", { status, origem, dataDe, dataAte }],
    queryFn: async () => {
      let q = supabase
        .from("wa_campanhas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status !== "todos") q = q.eq("status", status);
      if (origem !== "todas") q = q.eq("origem", origem);
      if (dataDe) q = q.gte("created_at", `${dataDe}T00:00:00`);
      if (dataAte) q = q.lte("created_at", `${dataAte}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      const campanhasBase = (data ?? []) as Campanha[];
      const campanhaIds = campanhasBase.map((c) => c.id);

      if (campanhaIds.length === 0) return [] as CampanhaComTotais[];

      const [destRes, envRes] = await Promise.all([
        supabase
          .from("wa_campanha_destinatarios")
          .select("id,campanha_id,status,envelope_docusign_id,assinado_em,updated_at")
          .in("campanha_id", campanhaIds)
          .limit(10000),
        supabase
          .from("docusign_envelopes")
          .select("campanha_id,envelope_id,status,sent_at,completed_at,declined_at,voided_at,last_event_at")
          .in("campanha_id", campanhaIds)
          .limit(10000),
      ]);

      if (destRes.error) throw destRes.error;
      if (envRes.error) throw envRes.error;

      const envelopes = (envRes.data ?? []) as Envelope[];
      const envelopePorId = new Map<string, Envelope>();
      for (const env of envelopes) envelopePorId.set(env.envelope_id, env);

      const totaisPorCampanha = new Map<string, CampanhaComTotais["totaisAssinatura"]>();
      for (const dest of (destRes.data ?? []) as Destinatario[]) {
        const total = totaisPorCampanha.get(dest.campanha_id) ?? {
          destinatarios: 0,
          enviados: 0,
          entregues: 0,
          assinados: 0,
          pendentes: 0,
          erros: 0,
        };
        const env = dest.envelope_docusign_id ? envelopePorId.get(dest.envelope_docusign_id) : undefined;
        const { status: statusAssinatura } = getStatusAssinatura(dest, env);
        total.destinatarios++;
        if (statusAssinatura === "enviado") total.enviados++;
        if (statusAssinatura === "entregue") total.entregues++;
        if (statusAssinatura === "assinado") total.assinados++;
        if (statusAssinatura === "pendente") total.pendentes++;
        if (statusAssinatura === "erro") total.erros++;
        totaisPorCampanha.set(dest.campanha_id, total);
      }

      return campanhasBase.map((campanha) => ({
        ...campanha,
        totaisAssinatura: totaisPorCampanha.get(campanha.id) ?? {
          destinatarios: 0,
          enviados: 0,
          entregues: 0,
          assinados: 0,
          pendentes: 0,
          erros: 0,
        },
      }));
    },
  });

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return campanhas;
    return campanhas.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.modelo_docusign_nome ?? "").toLowerCase().includes(t),
    );
  }, [campanhas, busca]);

  const resumo = useMemo(() => {
    let total = 0;
    let enviados = 0;
    let assinados = 0;
    let pendentes = 0;
    let erros = 0;
    for (const c of filtradas) {
      const t = c.totaisAssinatura;
      total += t.destinatarios;
      enviados += t.enviados;
      assinados += t.assinados;
      pendentes += t.pendentes + t.entregues;
      erros += t.erros;
    }
    return { total, enviados, assinados, pendentes, erros };
  }, [filtradas]);

  const limpar = () => {
    setBusca("");
    setStatus("todos");
    setOrigem("todas");
    setDataDe("");
    setDataAte("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-[18px] font-bold">
          <BarChart3 className="h-6 w-6" /> Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione um disparo para ver o status de assinatura de cada destinatário e os horários.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Destinatários</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{resumo.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Enviados</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {resumo.enviados}
            <span className="ml-2 text-xs text-muted-foreground">{pct(resumo.enviados, resumo.total)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Assinados</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {resumo.assinados}
            <span className="ml-2 text-xs text-muted-foreground">{pct(resumo.assinados, resumo.total)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pendentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{resumo.pendentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Erros</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{resumo.erros}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label htmlFor="busca">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="busca" className="pl-8" placeholder="Nome ou modelo" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CampanhaStatus | "todos")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(STATUS_LABEL) as CampanhaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={origem} onValueChange={(v) => setOrigem(v as CampanhaOrigem | "todas")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(Object.keys(ORIGEM_LABEL) as CampanhaOrigem[]).map((o) => (
                  <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </div>
          <div className="md:col-span-6">
            <Button variant="outline" size="sm" onClick={limpar}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destin.</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Assinados</TableHead>
                <TableHead className="text-right">Erros</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma campanha encontrada.</TableCell></TableRow>
                ) : filtradas.map((c) => {
                const t = c.totaisAssinatura;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">{c.modelo_docusign_nome ?? "—"}</div>
                    </TableCell>
                    <TableCell>{ORIGEM_LABEL[c.origem]}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge></TableCell>
                    <TableCell className="text-right">{t.destinatarios}</TableCell>
                    <TableCell className="text-right">{t.enviados}</TableCell>
                    <TableCell className="text-right">{t.assinados}</TableCell>
                    <TableCell className="text-right">{t.erros}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setAberta(c)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {aberta && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div>
                    <DialogTitle>{aberta.nome}</DialogTitle>
                    <DialogDescription>
                      {aberta.modelo_docusign_nome ?? "—"} · Criada em {formatDate(aberta.created_at)}
                    </DialogDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/relatorios/$campanhaId" params={{ campanhaId: aberta.id }}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir em página
                    </Link>
                  </Button>
                </div>
              </DialogHeader>
              <RelatorioDetalheView campanhaId={aberta.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
