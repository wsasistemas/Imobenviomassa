import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Nivel, Permissao } from "@/lib/permissoes";
import type { PermissionId } from "@/config/menu-registry";
import { canOpenWith, computePermissions, resolvePermissionForPath, type Regras } from "@/lib/acesso/policy";
import { souSuperAdminCentral } from "@/lib/app-access";

/** Permissão antiga (3 níveis fixos) → id do menu-registry. As telas migram para `podeAcessar` aos poucos. */
const PERMISSAO_LEGADA: Record<Permissao, PermissionId> = {
  verDashboard: "ver_dashboard",
  criarDisparo: "criar_disparo",
  verHistorico: "ver_historico",
  verRelatorios: "ver_relatorios",
  integracoes: "configure_integrations",
  gateway: "gateway_apis",
  logs: "view_audit_logs",
  privacidade: "manage_privacy",
  credenciais: "gerenciar_credenciais",
  usuarios: "manage_users",
};

export interface CurrentUser {
  user: User | null;
  fullName: string | null;
  email: string | null;
  /** Perfil no app (chave: super_admin, admin, analista ou um criado na tela Perfis e permissões). */
  perfil: string | null;
  perfilNome: string | null;
  imobiliariaId: string | null;
  imobiliariaNome: string | null;
  /** Compatibilidade: [perfil]. */
  roles: string[];
  /** Compatibilidade com os 3 níveis antigos (perfis criados contam como Analista). */
  nivel: Nivel | null;
  isAdmin: boolean;
  ativo: boolean;
  trocarSenha: boolean;
  /** Super admin da Central de acessos do ikvj: só ele vê "Permissões por aplicativo". */
  souSuperAdminCentral: boolean;
  loading: boolean;
  /** Regra antiga por nome; traduzida para o id do menu-registry. */
  pode: (p: Permissao) => boolean;
  /** Permissões efetivas por id do menu-registry. */
  permissoes: Record<PermissionId, boolean>;
  podeAcessar: (id: PermissionId) => boolean;
  /** Item abre na sidebar/cards (agrupador: algum filho abre). */
  canOpen: (id: PermissionId) => boolean;
  canAccessPath: (pathname: string) => boolean;
}

type Estado = Omit<CurrentUser, "pode" | "permissoes" | "podeAcessar" | "canOpen" | "canAccessPath" | "roles" | "nivel" | "isAdmin"> & {
  regras: Regras;
};

const VAZIO: Estado = {
  user: null,
  fullName: null,
  email: null,
  perfil: null,
  perfilNome: null,
  imobiliariaId: null,
  imobiliariaNome: null,
  ativo: true,
  trocarSenha: false,
  souSuperAdminCentral: false,
  loading: true,
  regras: {},
};

/**
 * Lê o acesso do usuário logado (imobenviomassa.meu_acesso: só devolve linha se ele estiver ativo, numa
 * imobiliária ativa e liberado na Central). Sem linha = sem acesso (fail closed).
 */
export async function carregarAcesso(user: User): Promise<Omit<Estado, "user" | "loading">> {
  const [acesso, cadastro, central] = await Promise.all([
    supabase.rpc("meu_acesso"),
    supabase.from("usuarios").select("nome, email").eq("id", user.id).maybeSingle(),
    souSuperAdminCentral(),
  ]);
  const linha = !acesso.error && Array.isArray(acesso.data) ? acesso.data[0] : null;
  return {
    fullName: cadastro.data?.nome ?? user.user_metadata?.full_name ?? user.email ?? null,
    email: cadastro.data?.email ?? user.email ?? null,
    perfil: linha?.perfil ?? null,
    perfilNome: linha?.perfil_nome ?? null,
    imobiliariaId: linha?.imobiliaria_id ?? null,
    imobiliariaNome: linha?.imobiliaria_nome ?? null,
    ativo: !!linha && linha.ativo !== false,
    trocarSenha: !!linha && linha.trocar_senha === true,
    souSuperAdminCentral: central,
    regras: ((linha?.regras ?? {}) as Regras) || {},
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

  const permissoes = useMemo(() => {
    const liberado = state.ativo && !state.trocarSenha && !!state.perfil;
    return computePermissions(liberado ? state.perfil : null, state.regras, liberado && state.souSuperAdminCentral);
  }, [state.ativo, state.trocarSenha, state.perfil, state.regras, state.souSuperAdminCentral]);

  const podeAcessar = useCallback((id: PermissionId) => permissoes[id] === true, [permissoes]);
  const pode = useCallback((p: Permissao) => permissoes[PERMISSAO_LEGADA[p]] === true, [permissoes]);
  const canOpen = useCallback((id: PermissionId) => canOpenWith(permissoes, id), [permissoes]);
  const canAccessPath = useCallback(
    (pathname: string) => {
      const id = resolvePermissionForPath(pathname);
      return id === null || permissoes[id] === true;
    },
    [permissoes],
  );

  const nivel: Nivel | null = !state.perfil
    ? null
    : state.perfil === "super_admin"
      ? "superadmin"
      : state.perfil === "admin"
        ? "admin"
        : "analista";

  return {
    ...state,
    roles: state.perfil ? [state.perfil] : [],
    nivel,
    isAdmin: state.perfil === "super_admin",
    pode,
    permissoes,
    podeAcessar,
    canOpen,
    canAccessPath,
  };
}
