import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Campanha = Database["imobenviomassa"]["Tables"]["wa_campanhas"]["Row"];

/** Últimas campanhas e os totais do Dashboard (também usados nos indicadores da Página Inicial). */
export function useResumoDisparos({ enabled = true }: { enabled?: boolean } = {}) {
  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: ["dashboard_campanhas"],
    enabled,
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

  return { campanhas, isLoading, totalHoje, totalEnviados, totalErros, totalDestinatarios, aguardando };
}
