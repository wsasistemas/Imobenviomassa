import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sairDoPortal } from "@/lib/sessao";
import { precisaDeDesafioMfa } from "@/components/mfa-challenge";
import { AppShell } from "@/components/app-shell";
import { conferirAcessoApp } from "@/lib/app-access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Mesmo modelo do Portal DP / Gestão de Contratos: conta desativada não entra; troca de senha
    // pendente só libera a tela de troca. Falha na consulta = sem acesso (fail closed).
    const { data: membro, error: membroErr } = await supabase
      .from("wa_project_users")
      .select("ativo, trocar_senha")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (membroErr) {
      await sairDoPortal({ redirecionar: false });
      toast.error("Não foi possível validar seu acesso.", { description: "Tente novamente em instantes." });
      throw redirect({ to: "/auth" });
    }
    if (!membro || membro.ativo === false) {
      await sairDoPortal({ redirecionar: false });
      toast.error(
        membro ? "Seu acesso ao portal está desativado." : "Sua conta não tem acesso a este portal.",
        { description: "Fale com o administrador do sistema." },
      );
      throw redirect({ to: "/auth" });
    }
    if (membro.trocar_senha === true) throw redirect({ to: "/trocar-senha" });
    // Central de acessos Calper (Permissões por aplicativo): bloqueado não entra nem continua.
    if (!(await conferirAcessoApp())) throw redirect({ to: "/auth" });
    // Sessão parcial (senha ok, 2º fator pendente) não entra: volta ao login para concluir o desafio.
    if (await precisaDeDesafioMfa()) {
      await sairDoPortal({ redirecionar: false });
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
