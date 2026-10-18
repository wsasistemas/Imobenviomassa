import {
  getPermission,
  menuChildrenOf,
  menuItemForPath,
  permissionEntries,
  type PermissionEntry,
  type PermissionId,
} from "@/config/menu-registry";

// Regra de acesso (padrão do Portal_Atendimento): sempre visível > super admin > só super admin > só admin >
// regra do perfil. Sem regra = negado. Um item filho só vale junto com o pai.

export const SUPER_ADMIN_ROLE = "super_admin";
export const ADMIN_ROLE = "admin";

export type Regras = Partial<Record<string, boolean>>;

export function isAllowed(entry: PermissionEntry, role: string | null, rules: Regras): boolean {
  if (entry.kind === "menu" && entry.alwaysVisible) return true;
  if (role === SUPER_ADMIN_ROLE) return true;
  if (entry.superAdminOnly || !role) return false;
  if (entry.adminOnly) return role === ADMIN_ROLE;
  return rules[entry.id] === true;
}

/** Vale só se o próprio item e todos os ancestrais estiverem liberados. */
export function isEffectivelyAllowed(id: string, role: string | null, rules: Regras): boolean {
  const entry = getPermission(id);
  if (!entry || !isAllowed(entry, role, rules)) return false;
  return entry.parent ? isEffectivelyAllowed(entry.parent, role, rules) : true;
}

/**
 * Permissões efetivas do usuário. `centralOnly` não depende do perfil deste portal: só o Super admin da Central de
 * acessos (pa_sou_super_admin) vê.
 */
export function computePermissions(
  role: string | null,
  rules: Regras,
  superAdminCentral: boolean,
): Record<PermissionId, boolean> {
  const out = {} as Record<PermissionId, boolean>;
  for (const entry of permissionEntries) {
    out[entry.id] =
      entry.kind === "menu" && entry.centralOnly ? superAdminCentral : isEffectivelyAllowed(entry.id, role, rules);
  }
  return out;
}

/** Abre o item: tem permissão e, se for agrupador sem tela, algum filho também abre. */
export function canOpenWith(perms: Record<PermissionId, boolean>, id: PermissionId): boolean {
  if (!perms[id]) return false;
  const entry = getPermission(id);
  if (entry?.kind === "menu" && !entry.path) {
    return menuChildrenOf(id).some((c) => canOpenWith(perms, c.id));
  }
  return true;
}

/** Permissão exigida pela rota; `null` = rota fora do registro (livre para quem está logado). */
export function resolvePermissionForPath(pathname: string): PermissionId | null {
  return menuItemForPath(pathname)?.id ?? null;
}
