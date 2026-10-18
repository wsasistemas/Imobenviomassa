import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ComAcesso } from "@/components/page";
import { Stepper } from "@/components/wizard/stepper";
import { useWizardStore } from "@/stores/wizard-store";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/disparo/novo")({
  component: () => (
    <ComAcesso permissao="criarDisparo">
      <NovoDisparoLayout />
    </ComAcesso>
  ),
});

function NovoDisparoLayout() {
  const reset = useWizardStore((s) => s.reset);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-bold">Novo Disparo em Massa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envio de documentos para assinatura em 6 etapas.
        </p>
      </div>

      <Stepper />

      <div className="flex items-end justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Descartar rascunho atual?")) reset();
          }}
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          Descartar
        </Button>
      </div>

      <Outlet />
    </div>
  );
}
