import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { nivelDosPapeis, nivelPode, type Nivel, type Permissao } from "@/lib/permissoes";
import { souSuperAdminCentral } from "@/lib/app-access";

export type AppRole = "super_admin" | "admin" | "operadora" | "cliente";

export interface CurrentUser {
  user: User | null;
  fullName: string | null;
  email: string | null;
  roles: AppRole[];
  /** Perfil do portal (Super Admin, Admin, Analista); null = sem perfil. */
  nivel: Nivel | null;
  isAdmin: boolean;
  ativo: boolean;
  trocarSenha: boolean;
  /** Super admin da Central de acessos Calper: só ele vê "Permissões por aplicativo". */
  souSuperAdminCentral: boolean;
  loading: boolean;
  pode: (p: Permissao) => boolean;
}

type Estado = Omit<CurrentUser, "pode">;

const VAZIO: Estado = {
  user: null,
  fullName: null,
  email: null,
  roles: [],
  nivel: null,
  isAdmin: false,
  ativo: true,
  trocarSenha: false,
  souSuperAdminCentral: false,
  loading: true,
};

/** Lê perfil, papéis e situação da conta (ativa / troca de senha pendente) do usuário logado. */
export async function carregarAcesso(user: User): Promise<Omit<Estado, "user" | "loading">> {
  const [{ data: profile }, { data: roles }, membro, central] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("wa_project_users").select("ativo, trocar_senha").eq("user_id", user.id).maybeSingle(),
    souSuperAdminCentral(),
  ]);
  const rolesList = (roles ?? []).map((r) => r.role as AppRole);
  const nivel = nivelDosPapeis(rolesList);
  return {
    fullName: profile?.full_name ?? user.email ?? null,
    email: profile?.email ?? user.email ?? null,
    roles: rolesList,
    nivel,
    isAdmin: nivel === "superadmin",
    // Todo usuário do portal tem linha de membro: sem linha, sem acesso. Se a consulta falhar,
    // a conta é tratada como inativa (fail closed).
    ativo: !membro.error && !!membro.data && membro.data.ativo !== false,
    trocarSenha: !membro.error && !!membro.data && membro.data.trocar_senha === true,
    souSuperAdminCentral: central,
  };
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<Estado>(VAZIO);

  useEffect(() => {
    let mounted = true;

    async function load(user: User) {
      const acesso = await carregarAcesso(user);
      if (mounted) setState({ user, ...acesso, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) load(data.user);
      else setState({ ...VAZIO, loading: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) load(session.user);
      else setState({ ...VAZIO, loading: false });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const pode = useCallback(
    (p: Permissao) => state.ativo && !state.trocarSenha && nivelPode(state.nivel, p),
    [state.ativo, state.trocarSenha, state.nivel],
  );

  return { ...state, pode };
}
