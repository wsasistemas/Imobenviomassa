import { createFileRoute, Link } from "@tanstack/react-router";
import { ComAcesso } from "@/components/page";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, History, Search, Send } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Campanha = Database["imobenviomassa"]["Tables"]["wa_campanhas"]["Row"];
type CampanhaStatus = Database["imobenviomassa"]["Enums"]["wa_campanha_status"];
type CampanhaOrigem = Database["imobenviomassa"]["Enums"]["wa_campanha_origem"];

export const Route = createFileRoute("/_authenticated/campanhas")({
  component: () => (
    <ComAcesso permissao="verHistorico">
      <CampanhasPage />
    </ComAcesso>
  ),
});

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

function CampanhasPage() {
  const [busca, setBusca] = useState("");

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["wa_campanhas_historico"],
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

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return campanhas;
    return campanhas.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.modelo_docusign_nome ?? "").toLowerCase().includes(t),
    );
  }, [campanhas, busca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-bold">Histórico de Campanhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista simples de todas as campanhas. Para métricas e detalhes, abra o Relatório.
          </p>
        </div>
        <Button asChild>
          <Link to="/disparo/novo">
            <Send className="mr-2 h-4 w-4" /> Novo Disparo
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou modelo…"
          className="pl-8"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtradas.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Nenhuma campanha encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="w-[120px] text-right">Relatório</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        Carregando…
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtradas.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{ORIGEM_LABEL[c.origem]}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.modelo_docusign_nome ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to="/relatorios/$campanhaId" params={{ campanhaId: c.id }}>
                              <BarChart3 className="mr-1 h-4 w-4" /> Abrir
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
