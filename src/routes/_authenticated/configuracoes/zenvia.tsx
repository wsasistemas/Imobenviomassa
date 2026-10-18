import { createFileRoute } from "@tanstack/react-router";
import { AbasIntegracoes } from "@/components/integracoes/abas-integracoes";
import { ZenviaPainel } from "@/components/integracoes/zenvia-painel";
import { PageHead, SemAcesso } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/configuracoes/zenvia")({
  component: ZenviaPage,
});

function ZenviaPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("integracoes")) return <SemAcesso texto="Seu perfil não tem acesso às integrações." />;
  return (
    <div className="flex flex-col gap-5">
      <AbasIntegracoes />
      <PageHead title="Zenvia WhatsApp">
        Conta, webhooks, números remetentes e templates usados pela Régua de Cobrança. Admin
        consulta e testa; só o Super Admin troca o token.
      </PageHead>
      <ZenviaPainel />
    </div>
  );
}
