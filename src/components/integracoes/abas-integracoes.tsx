import type { ComponentType } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Mail, Network, PlugZap } from "lucide-react";
import { SimboloDocuSign, SimboloWhatsApp } from "@/components/icones/marcas";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Permissao } from "@/lib/permissoes";
import { cn } from "@/lib/utils";

// Integrações = uma tela com cinco abas (plano, Fase 5; Zenvia e E-mail da Régua de Cobrança). Cada aba continua com a própria URL: o retorno do
// preview DocuSign (docusign.functions.ts) e os atalhos de /admin/* apontam para /configuracoes/docusign e
// /configuracoes/gateway, então as abas navegam entre as rotas em vez de trocar conteúdo no lugar.
const ABAS: { to: string; label: string; icon: ComponentType<{ className?: string }>; permissao: Permissao }[] = [
  { to: "/configuracoes/integracoes", label: "TOTVS RM", icon: PlugZap, permissao: "integracoes" },
  {
    to: "/configuracoes/docusign",
    label: "DocuSign",
    icon: SimboloDocuSign,
    permissao: "integracoes",
  },
  { to: "/configuracoes/gateway", label: "Gateway de APIs", icon: Network, permissao: "gateway" },
  {
    to: "/configuracoes/zenvia",
    label: "Zenvia WhatsApp",
    icon: SimboloWhatsApp,
    permissao: "integracoes",
  },
  { to: "/configuracoes/email", label: "E-mail", icon: Mail, permissao: "integracoes" },
];

export function AbasIntegracoes() {
  const { pode } = useCurrentUser();
  const { pathname } = useLocation();
  const visiveis = ABAS.filter((a) => pode(a.permissao));
  if (visiveis.length < 2) return null;

  return (
    <nav
      aria-label="Integrações"
      className="inline-flex h-10 max-w-full items-center self-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground"
    >
      {visiveis.map(({ to, label, icon: Icon }) => {
        const ativa = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              ativa ? "bg-background text-foreground shadow" : "hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
