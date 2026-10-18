import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BarChart3,
  Banknote,
  FileSignature,
  GraduationCap,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  Network,
  PlugZap,
  ScrollText,
  Send,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
} from "lucide-react";

// Fonte única do portal (padrão menuRegistry do Portal_Atendimento): sidebar, breadcrumb, cards da Página Inicial,
// guarda de rotas e matriz de Perfis e permissões saem daqui. O `id` é a permissão gravada no banco.
// Menu novo = uma linha aqui (e o ícone colorido em scripts/gerar-icones.mjs).

export type MenuGroup = "principal" | "configuracoes" | "rodape";

export interface MenuItemDefinition {
  id: string;
  label: string;
  /** Rota da tela. Item sem `path` é só um agrupador (ex.: Disparo em Massa, DocuSign). */
  path?: string;
  icon: LucideIcon;
  group: MenuGroup;
  /** Texto do card na Página Inicial e da matriz de permissões. */
  description?: string;
  /** Item filho: aparece aninhado na sidebar (ou como seção da tela do pai) e na matriz. */
  parent?: string;
  /** Seção da tela do pai (abas): não aparece na sidebar. */
  section?: boolean;
  /** Liberado para qualquer usuário logado. */
  alwaysVisible?: boolean;
  /** Regra fixa do negócio: só Admin e Super admin, não marcável na matriz. */
  adminOnly?: boolean;
  /** Só Super admin. */
  superAdminOnly?: boolean;
  /** Só o Super admin da Central de acessos (vale para todos os sistemas do login compartilhado). */
  centralOnly?: boolean;
  /** Tela ainda sem conteúdo. */
  emConstrucao?: boolean;
}

/** Permissão de ação (botão), sem rota: só vale junto com o pai. */
export interface ActionDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  parent: string;
  description?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const definitions = [
  // ===== Menu principal =====
  { id: "home", label: "Página Inicial", path: "/home", icon: Home, group: "principal", alwaysVisible: true },
  {
    id: "disparos",
    label: "Disparo em Massa",
    icon: Send,
    group: "principal",
    description: "Envio de documentos e cobranças em lote.",
  },
  {
    id: "docusign",
    label: "DocuSign",
    icon: FileSignature,
    group: "principal",
    parent: "disparos",
    description: "Envio de documentos para assinatura via DocuSign.",
  },
  {
    id: "ver_dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    group: "principal",
    parent: "docusign",
    description: "Visão geral e estatísticas dos disparos realizados.",
  },
  {
    id: "criar_disparo",
    label: "Novo Disparo",
    path: "/disparo/novo",
    icon: Send,
    group: "principal",
    parent: "docusign",
    description: "Inicie um novo envio de documentos para assinatura.",
  },
  {
    id: "ver_historico",
    label: "Histórico",
    path: "/campanhas",
    icon: History,
    group: "principal",
    parent: "docusign",
    description: "Consulte as campanhas já realizadas e seus destinatários.",
  },
  {
    id: "ver_relatorios",
    label: "Relatórios",
    path: "/relatorios",
    icon: BarChart3,
    group: "principal",
    parent: "docusign",
    description: "Análise detalhada de assinaturas e status por campanha.",
  },
  {
    id: "regua_cobranca",
    label: "Régua de Cobrança",
    path: "/regua-cobranca",
    icon: Banknote,
    group: "principal",
    parent: "disparos",
    description: "Lembretes automáticos de cobrança aos compradores.",
    emConstrucao: true,
  },
  {
    id: "treinamento",
    label: "Centro de Treinamento",
    path: "/treinamento",
    icon: GraduationCap,
    group: "principal",
    alwaysVisible: true,
    description: "Guias ilustrados, do primeiro acesso ao acompanhamento das assinaturas.",
  },

  // ===== Configurações =====
  {
    id: "manage_users",
    label: "Usuários",
    path: "/administracao/usuarios",
    icon: Users,
    group: "configuracoes",
    description: "Cadastre usuários, defina o perfil e gere senhas.",
  },
  {
    id: "manage_permissions",
    label: "Perfis e permissões",
    path: "/administracao/perfis",
    icon: UserCog,
    group: "configuracoes",
    description: "Crie perfis e escolha quais menus cada um pode abrir.",
  },
  {
    id: "manage_app_access",
    label: "Permissões por aplicativo",
    path: "/administracao/permissoes-aplicativo",
    icon: AppWindow,
    group: "configuracoes",
    superAdminOnly: true,
    centralOnly: true,
    description: "Quem pode entrar em cada sistema do login compartilhado.",
  },
  {
    id: "configure_integrations",
    label: "Integrações",
    path: "/configuracoes/integracoes",
    icon: PlugZap,
    group: "configuracoes",
    adminOnly: true,
    description: "TOTVS RM, DocuSign e Gateway de APIs.",
  },
  {
    id: "integracao_docusign",
    label: "Integração DocuSign",
    path: "/configuracoes/docusign",
    icon: FileSignature,
    group: "configuracoes",
    parent: "configure_integrations",
    section: true,
    adminOnly: true,
    description: "Conta, chaves e webhook do DocuSign.",
  },
  {
    id: "gateway_apis",
    label: "Gateway de APIs",
    path: "/configuracoes/gateway",
    icon: Network,
    group: "configuracoes",
    parent: "configure_integrations",
    section: true,
    description: "APIs registradas e execução pelo proxy.",
  },
  {
    id: "view_audit_logs",
    label: "Auditoria",
    path: "/administracao/logs",
    icon: ScrollText,
    group: "configuracoes",
    description: "Registro de tudo o que foi feito no portal.",
  },
  {
    id: "manage_privacy",
    label: "Privacidade (LGPD)",
    path: "/administracao/privacidade",
    icon: UserX,
    group: "configuracoes",
    description: "Descadastro, direitos do titular, anonimização e retenção.",
  },

  // ===== Rodapé da sidebar =====
  {
    id: "conta_seguranca",
    label: "Alterar senha e MFA",
    path: "/conta/seguranca",
    icon: ShieldCheck,
    group: "rodape",
    alwaysVisible: true,
  },
] as const satisfies readonly MenuItemDefinition[];

const actions = [
  {
    id: "gerenciar_credenciais",
    label: "Cadastrar e trocar credenciais",
    icon: KeyRound,
    parent: "configure_integrations",
    superAdminOnly: true,
    description: "Usuário e senha do TOTVS RM, chaves do DocuSign e APIs do Gateway.",
  },
] as const satisfies readonly ActionDefinition[];

export type MenuItemId = (typeof definitions)[number]["id"];
export type ActionId = (typeof actions)[number]["id"];
export type PermissionId = MenuItemId | ActionId;

export type MenuItem = MenuItemDefinition & { id: MenuItemId };
export type MenuAction = ActionDefinition & { id: ActionId };

// Versões tipadas: acessar campos opcionais direto na união `as const` dá erro TS2339.
export const menuRegistry: readonly MenuItem[] = definitions;
export const actionRegistry: readonly MenuAction[] = actions;

/** Item da matriz de permissões: menu ou ação. */
export type PermissionEntry = (MenuItem & { kind: "menu" }) | (MenuAction & { kind: "acao" });

export const permissionEntries: readonly PermissionEntry[] = [
  ...menuRegistry.map((m) => ({ ...m, kind: "menu" as const })),
  ...actionRegistry.map((a) => ({ ...a, kind: "acao" as const })),
];

export const menuGroups: { id: Exclude<MenuGroup, "rodape">; label: string }[] = [
  { id: "principal", label: "Menu principal" },
  { id: "configuracoes", label: "Configurações" },
];

export function getMenuItem(id: string): MenuItem | undefined {
  return menuRegistry.find((m) => m.id === id);
}

export function getPermission(id: string): PermissionEntry | undefined {
  return permissionEntries.find((p) => p.id === id);
}

export function isPermissionId(id: string): id is PermissionId {
  return permissionEntries.some((p) => p.id === id);
}

/** Itens de primeiro nível de um grupo. */
export function menuItemsByGroup(group: MenuGroup): MenuItem[] {
  return menuRegistry.filter((m) => m.group === group && !m.parent);
}

/** Filhos de menu (subitens e seções) de um item. */
export function menuChildrenOf(id: string): MenuItem[] {
  return menuRegistry.filter((m) => m.parent === id);
}

/** Filhos na matriz de permissões (menus e ações). */
export function permissionChildrenOf(id: string): PermissionEntry[] {
  return permissionEntries.filter((p) => p.parent === id);
}

/** Cadeia de ancestrais (do mais alto ao item). */
export function ancestorsOf(id: string): MenuItem[] {
  const chain: MenuItem[] = [];
  let atual = getMenuItem(id);
  while (atual) {
    chain.unshift(atual);
    atual = atual.parent ? getMenuItem(atual.parent) : undefined;
  }
  return chain;
}

export function isActivePath(pathname: string, path: string | undefined) {
  return !!path && (pathname === path || pathname.startsWith(path + "/"));
}

/** Item de menu da rota atual: o caminho mais longo que casa (evita /configuracoes/x casar com /configuracoes). */
export function menuItemForPath(pathname: string): MenuItem | undefined {
  return menuRegistry
    .filter((m) => isActivePath(pathname, m.path))
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];
}

/** Trilha do breadcrumb: ["Início", grupo?, ...ancestrais, página]. */
export function trilhaDe(pathname: string): string[] {
  const item = menuItemForPath(pathname);
  if (!item || item.id === "home") return ["Início"];
  const chain = ancestorsOf(item.id).map((m) => m.label);
  if (item.group === "configuracoes") return ["Início", "Configurações", ...chain];
  return ["Início", ...chain];
}
