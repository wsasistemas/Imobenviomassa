import { NIVEL_LABEL, nivelDosPapeis } from "@/lib/permissoes";

// O menu (sidebar, breadcrumb, cards e permissões) agora sai de src/config/menu-registry.ts.

/** Rótulo do perfil mais alto do usuário (um usuário pode ter vários papéis). */
export function perfilPrincipal(roles: string[]): string {
  const nivel = nivelDosPapeis(roles);
  return nivel ? NIVEL_LABEL[nivel] : "Sem perfil";
}
