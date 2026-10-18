import { createFileRoute } from "@tanstack/react-router";
import { AbasIntegracoes } from "@/components/integracoes/abas-integracoes";
import { DocusignForm } from "@/components/integracoes/paineis";
import { DocusignJsonReference } from "@/components/integracoes/docusign-json-reference";
import { PageHead, SemAcesso } from "@/components/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/configuracoes/docusign")({
  component: DocusignPage,
});

function DocusignPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("integracoes")) return <SemAcesso texto="Seu perfil não tem acesso às integrações." />;

  return (
    <div className="flex flex-col gap-5">
      <AbasIntegracoes />
      <PageHead title="Integração DocuSign">
        Conta, chave de integração e modelos de documento usados no envio para assinatura. Admin consulta e testa a
        conexão; só um Super Admin altera as credenciais.
      </PageHead>
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="json">Referência JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <DocusignForm />
        </TabsContent>
        <TabsContent value="json">
          <DocusignJsonReference />
        </TabsContent>
      </Tabs>
    </div>
  );
}
