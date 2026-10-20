import type { PermissionId } from "@/config/menu-registry";

// Matriz de permissões por perfil — mesmo modelo do Portal DP e do Gestão de Contratos.
// Para mudar o que um perfil pode fazer, edite apenas este arquivo (e as checagens do servidor em
// src/lib/authz.ts e nas Edge Functions, que espelham estas regras).

/** Perfis fixos do portal. No banco (user_roles.role): super_admin, admin e operadora. */
export type Nivel = "superadmin" | "admin" | "analista";

export type Permissao =
  /* Analista */
  | "verDashboard"
  | "criarDisparo"
  | "verHistorico"
  | "verRelatorios"
  /* Admin */
  | "integracoes" // consultar e testar as integrações TOTVS RM e DocuSign
  | "gateway" // Gateway de APIs
  | "logs"
  | "privacidade" // LGPD: descadastro, direitos do titular, anonimização e retenção
  /* Super Admin */
  | "credenciais" // cadastrar/trocar credenciais do TOTVS RM e do DocuSign
  | "usuarios";

const ANALISTA: Permissao[] = ["verDashboard", "criarDisparo", "verHistorico", "verRelatorios"];
const ADMIN: Permissao[] = [...ANALISTA, "integracoes", "gateway", "logs", "privacidade"];
const SUPERADMIN: Permissao[] = [...ADMIN, "credenciais", "usuarios"];

export const PERMISSOES: Record<Nivel, ReadonlySet<Permissao>> = {
  superadmin: new Set(SUPERADMIN),
  admin: new Set(ADMIN),
  analista: new Set(ANALISTA),
};

export const NIVEIS: Nivel[] = ["superadmin", "admin", "analista"];

export const NIVEL_LABEL: Record<Nivel, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  analista: "Analista",
};

/** Papel gravado em user_roles para cada perfil. */
export const PAPEL_DO_NIVEL: Record<Nivel, "super_admin" | "admin" | "operadora"> = {
  superadmin: "super_admin",
  admin: "admin",
  analista: "operadora",
};

export const DESCRICAO_NIVEL: Record<Nivel, string> = {
  superadmin: "Super Admin — acesso total: usuários, credenciais das integrações e todos os menus",
  admin: "Admin — disparos, integrações (consulta e teste), Gateway de APIs, Logs Gerais e Privacidade (LGPD)",
  analista: "Analista — dashboard, novo disparo, histórico e relatórios",
};

/** Seções da matriz da tela Perfis, na ordem em que aparecem. */
export const GRUPOS_PERMISSAO = ["Disparo de Cobranças e Documentos", "Configurações", "Administração"] as const;
export type GrupoPermissao = (typeof GRUPOS_PERMISSAO)[number];

export const PERMISSAO_INFO: Record<Permissao, { rotulo: string; grupo: GrupoPermissao }> = {
  verDashboard: { rotulo: "Ver o Dashboard dos disparos", grupo: "Disparo de Cobranças e Documentos" },
  criarDisparo: { rotulo: "Criar novo disparo (consulta compradores no TOTVS RM)", grupo: "Disparo de Cobranças e Documentos" },
  verHistorico: { rotulo: "Consultar o histórico de campanhas", grupo: "Disparo de Cobranças e Documentos" },
  verRelatorios: { rotulo: "Ver relatórios de assinaturas", grupo: "Disparo de Cobranças e Documentos" },
  integracoes: { rotulo: "Consultar e testar as integrações TOTVS RM e DocuSign", grupo: "Configurações" },
  credenciais: { rotulo: "Cadastrar e trocar credenciais das integrações", grupo: "Configurações" },
  gateway: { rotulo: "Usar o Gateway de APIs", grupo: "Configurações" },
  usuarios: { rotulo: "Gerenciar usuários e senhas", grupo: "Administração" },
  logs: { rotulo: "Ver os Logs Gerais", grupo: "Administração" },
  privacidade: { rotulo: "Privacidade e LGPD (descadastro, direitos do titular)", grupo: "Administração" },
};

/** Perfil mais alto a partir dos papéis do usuário; null = sem perfil (nenhum menu liberado). */
export function nivelDosPapeis(roles: string[]): Nivel | null {
  if (roles.includes("super_admin")) return "superadmin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("operadora")) return "analista";
  return null;
}

export function nivelPode(nivel: Nivel | null | undefined, permissao: Permissao): boolean {
  return !!nivel && PERMISSOES[nivel].has(permissao);
}

/**
 * Liberações de cada nível nos ids do menu-registry. Transição: na Fase 3 os perfis e a matriz vão para o banco
 * (imobenviomassa.perfil_permissoes) e esta tabela é só o espelho do seed (provisionar_imobiliaria).
 */
export const REGRAS_DO_NIVEL: Record<Nivel, readonly PermissionId[]> = {
  superadmin: [],
  admin: [
    "disparos",
    "docusign",
    "ver_dashboard",
    "criar_disparo",
    "ver_historico",
    "ver_relatorios",
    "gateway_apis",
    "view_audit_logs",
    "manage_privacy",
    "regua_cobranca",
    "regua_dashboard_ver",
    "regua_lote_criar",
    "regua_lote_acionar",
    "regua_disparo_extraordinario",
    "regua_auditoria_ver",
    "regua_templates",
    "regua_config_editar",
  ],
  analista: ["disparos", "docusign", "ver_dashboard", "criar_disparo", "ver_historico", "ver_relatorios"],
};
