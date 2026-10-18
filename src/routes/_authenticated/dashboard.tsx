import { createFileRoute, Link } from "@tanstack/react-router";
import { ComAcesso } from "@/components/page";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCircle2, Clock, AlertCircle, TrendingUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Database } from "@/integrations/supabase/types";

type Campanha = Database["public"]["Tables"]["wa_campanhas"]["Row"];
type CampanhaStatus = Database["public"]["Enums"]["wa_campanha_status"];

const STATUS_LABEL: Record<CampanhaStatus, string> = {
  rascunho: "Rascunho",
  rascunho_confirmado: "Confirmada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  erro: "Com erro",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<CampanhaStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  rascunho_confirmado: "secondary",
  em_execucao: "default",
  concluida: "default",
  erro: "destructive",
  cancelada: "outline",
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <ComAcesso permissao="verDashboard">
      <DashboardPage />
    </ComAcesso>
  ),
});

function DashboardPage() {
  const { fullName } = useCurrentUser();

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["dashboard_campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_campanhas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Campanha[];
    },
  });

  const hojeStr = new Date().toISOString().slice(0, 10);
  const totalHoje = campanhas.filter((c) => c.created_at.slice(0, 10) === hojeStr).length;
  const somaCampo = (campo: "destinatarios" | "enviados" | "erros") =>
    campanhas.reduce((acc, c) => {
      const t = (c.totais ?? {}) as Record<string, unknown>;
      return acc + Number(t[campo] ?? 0);
    }, 0);
  const totalEnviados = somaCampo("enviados");
  const totalErros = somaCampo("erros");
  const totalDestinatarios = somaCampo("destinatarios");
  const aguardando = Math.max(totalDestinatarios - totalEnviados - totalErros, 0);

  const kpis = [
    {
      label: "Disparos hoje",
      value: isLoading ? "…" : String(totalHoje),
      icon: Send,
      hint: totalHoje ? "Campanhas criadas hoje" : "Nenhum disparo hoje",
      color: "text-info",
    },
    {
      label: "Documentos enviados",
      value: isLoading ? "…" : String(totalEnviados),
      icon: TrendingUp,
      hint: "Todas as campanhas",
      color: "text-primary",
    },
    {
      label: "Aguardando assinatura",
      value: isLoading ? "…" : String(aguardando),
      icon: Clock,
      hint: "Em andamento",
      color: "text-warning",
    },
    {
      label: "Com problema",
      value: isLoading ? "…" : String(totalErros),
      icon: AlertCircle,
      hint: "Requerem atenção",
      color: "text-destructive",
    },
  ];

  const ultimas = campanhas.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-bold">
            Olá{fullName ? `, ${fullName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie documentos para assinatura via WhatsApp em poucos cliques.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/disparo/novo">
            <Send className="mr-2 h-4 w-4" />
            Novo Disparo
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{k.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Últimas campanhas</CardTitle>
          {campanhas.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/campanhas">Ver todas</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className={ultimas.length ? "p-0" : ""}>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : ultimas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nenhuma campanha ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Comece criando seu primeiro disparo em massa.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/disparo/novo">Criar disparo</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Enviados</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimas.map((c) => {
                    const totais = (c.totais ?? {}) as Record<string, unknown>;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(totais.destinatarios ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {Number(totais.enviados ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">
                          {Number(totais.erros ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/campanhas">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
