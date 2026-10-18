import { createFileRoute } from "@tanstack/react-router";
import { AbasIntegracoes } from "@/components/integracoes/abas-integracoes";
import { EmailPainel } from "@/components/integracoes/email-painel";
import { PageHead, SemAcesso } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/configuracoes/email")({
  component: EmailPage,
});

function EmailPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("integracoes")) return <SemAcesso texto="Seu perfil não tem acesso às integrações." />;
  return (
    <div className="flex flex-col gap-5">
      <AbasIntegracoes />
      <PageHead title="E-mail">
        Provedor que envia os e-mails da Régua de Cobrança: Zenvia E-mail, Resend (com domínio
        próprio verificado) ou SMTP próprio.
      </PageHead>
      <EmailPainel />
    </div>
  );
}
