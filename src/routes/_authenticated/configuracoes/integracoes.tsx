import { createFileRoute } from "@tanstack/react-router";
import { TotvsForm } from "@/components/integracoes/paineis";
import { SemAcesso } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/configuracoes/integracoes")({
  component: IntegracoesTotvsPage,
});

function IntegracoesTotvsPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("integracoes")) return <SemAcesso texto="Seu perfil não tem acesso às integrações." />;
  return <TotvsForm />;
}
