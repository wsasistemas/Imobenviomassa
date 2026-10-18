import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/page";
import { IconeDoMenu } from "@/components/icones/icone-colorido";

export const Route = createFileRoute("/_authenticated/regua-cobranca")({
  component: ReguaCobrancaPage,
});

// Submenu de Disparo em Massa ainda sem telas (pedido de 17/10/2026). Os menus entram aqui quando forem definidos.
function ReguaCobrancaPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Régua de Cobrança">Lembretes automáticos de cobrança aos compradores.</PageHead>
      <div className="flex flex-col items-center gap-2.5 rounded-xl border bg-card px-6 py-14 text-center shadow-card">
        <IconeDoMenu id="em_construcao" tamanho={56} />
        <h2 className="text-[17px] font-bold">Em construção</h2>
        <p className="max-w-[420px] text-[13px] text-muted-foreground">
          Este módulo ainda não tem telas. Quando estiver pronto, os menus dele aparecem aqui.
        </p>
      </div>
    </div>
  );
}
