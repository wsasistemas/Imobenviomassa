import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereços antigos (/admin/...) apontam para os menus Configurações e Administração.
const DESTINO: Record<string, string> = {
  integracoes: "/configuracoes/integracoes",
  gateway: "/configuracoes/gateway",
  modelos: "/configuracoes/docusign",
  usuarios: "/administracao/usuarios",
  logs: "/administracao/logs",
};

export const Route = createFileRoute("/_authenticated/admin/$")({
  beforeLoad: ({ params }) => {
    const primeiro = (params._splat ?? "").split("/")[0];
    throw redirect({ to: DESTINO[primeiro] ?? "/configuracoes/integracoes", replace: true });
  },
});
