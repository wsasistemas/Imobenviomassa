import { createFileRoute, Link } from "@tanstack/react-router";
import { ComAcesso } from "@/components/page";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RelatorioDetalheView, formatDate } from "@/components/relatorios/RelatorioDetalheView";
import type { Database } from "@/integrations/supabase/types";

type Campanha = Database["public"]["Tables"]["wa_campanhas"]["Row"];

export const Route = createFileRoute("/_authenticated/relatorios/$campanhaId")({
  component: () => (
    <ComAcesso permissao="verRelatorios">
      <RelatorioDetalhe />
    </ComAcesso>
  ),
});

function RelatorioDetalhe() {
  const { campanhaId } = Route.useParams();
  const [camp, setCamp] = useState<Campanha | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/relatorios"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
        <h1 className="text-[18px] font-bold">
          {camp?.nome ?? "Relatório"}
        </h1>
        {camp && (
          <p className="mt-1 text-sm text-muted-foreground">
            Modelo: {camp.modelo_docusign_nome ?? "—"} · Criada em {formatDate(camp.created_at)}
          </p>
        )}
      </div>

      <RelatorioDetalheView campanhaId={campanhaId} onCampanhaLoaded={setCamp} />
    </div>
  );
}
