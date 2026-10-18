import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sairDoPortal } from "@/lib/sessao";
import { precisaDeDesafioMfa } from "@/components/mfa-challenge";
import { AppShell } from "@/components/app-shell";
import { conferirAcessoApp } from "@/lib/app-access";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Conta sem cadastro, desativada, de imobiliária inativa ou bloqueada na Central não entra; troca de senha
    // pendente só libera a tela de troca. Falha na consulta = sem acesso (fail closed).
    const { data: acesso, error: acessoErr } = await supabase.rpc("meu_acesso");
    if (acessoErr) {
      await sairDoPortal({ redirecionar: false });
      toast.error("Não foi possível validar seu acesso.", { description: "Tente novamente em instantes." });
      throw redirect({ to: "/auth" });
    }
    const membro = Array.isArray(acesso) ? acesso[0] : null;
    if (!membro || membro.ativo === false) {
      await sairDoPortal({ redirecionar: false });
      toast.error("Sua conta não tem acesso a este portal.", {
        description: "Peça ao administrador da sua imobiliária para liberar o Envio em Massa.",
      });
      throw redirect({ to: "/auth" });
    }
    if (membro.trocar_senha === true) throw redirect({ to: "/trocar-senha" });
    // Central de acessos do ikvj (Permissões por aplicativo): bloqueado não entra nem continua.
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
      <RequirePermission>
        <Outlet />
      </RequirePermission>
    </AppShell>
  );
}

/** Guarda por permissão (padrão do Portal_Atendimento): a rota pede o id do menu-registry; sem acesso, volta ao início. */
function RequirePermission({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading, canAccessPath } = useCurrentUser();
  const negado = !loading && !canAccessPath(pathname);

  useEffect(() => {
    if (negado) toast.error("Você não tem acesso a esta área", { id: "no-access" });
  }, [negado]);

  if (loading) return null;
  if (negado) return <Navigate to="/home" replace />;
  return <>{children}</>;
}
