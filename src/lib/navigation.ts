import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BarChart3,
  FileSignature,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  Network,
  PlugZap,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  UserCog,
  UserX,
  UserRound,
  Users,
} from "lucide-react";
import { NIVEL_LABEL, nivelDosPapeis, type Permissao } from "@/lib/permissoes";

/** Permissão exigida para ver o item; `null` = qualquer perfil logado. */
export type Acesso = Permissao | null;

export interface NavLeaf {
  to: string;
  label: string;
  icon: LucideIcon;
  acesso: Acesso;
  /**
   * Só para o Super admin da Central (Gestão Comercial), não pelo perfil deste portal: usado em
   * "Permissões por aplicativo", que vale para todos os sistemas da Calper.
   */
  central?: boolean;
  /** Texto do card na página inicial. */
  descricao: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
  /** Item único: na sidebar aparece como botão direto (sem submenu), com o rótulo e o ícone do grupo. */
  direto?: boolean;
}

export const homeNav: NavLeaf = {
  to: "/home",
  label: "Página Inicial",
  icon: Home,
  acesso: null,
  descricao: "",
};

// Menus do portal (Disparo em Massa, Configurações, Administração) — mesmo modelo do Portal DP e do
// Gestão de Contratos. Adicione, remova ou reordene entradas aqui para reconfigurar a sidebar, o
// breadcrumb e os cards da página inicial ao mesmo tempo.
export const navGroups: NavGroup[] = [
  {
    id: "disparos",
    label: "Disparo em Massa",
    icon: Send,
    children: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        acesso: "verDashboard",
        descricao: "Visão geral e estatísticas dos disparos realizados.",
      },
      {
        to: "/disparo/novo",
        label: "Novo Disparo",
        icon: Send,
        acesso: "criarDisparo",
        descricao: "Inicie um novo envio de documentos para assinatura.",
      },
      {
        to: "/campanhas",
        label: "Histórico",
        icon: History,
        acesso: "verHistorico",
        descricao: "Consulte as campanhas já realizadas e seus destinatários.",
      },
      {
        to: "/relatorios",
        label: "Relatórios",
        icon: BarChart3,
        acesso: "verRelatorios",
        descricao: "Análise detalhada de assinaturas e status por campanha.",
      },
    ],
  },
  {
    id: "treinamento",
    label: "Centro de Treinamento",
    icon: GraduationCap,
    direto: true,
    children: [
      {
        to: "/treinamento",
        label: "Guias passo a passo",
        icon: GraduationCap,
        acesso: null,
        descricao: "Aprenda a usar o portal com guias ilustrados, do primeiro acesso ao acompanhamento das assinaturas.",
      },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: Settings,
    children: [
      {
        to: "/configuracoes/integracoes",
        label: "Integrações TOTVS RM",
        icon: PlugZap,
        acesso: "integracoes",
        descricao: "Empreendimentos e compradores lidos no TOTVS RM; credenciais da integração.",
      },
      {
        to: "/configuracoes/docusign",
        label: "Integração DocuSign",
        icon: FileSignature,
        acesso: "integracoes",
        descricao: "Conta, chave de integração e modelos de documento do DocuSign.",
      },
      {
        to: "/configuracoes/gateway",
        label: "Gateway de APIs",
        icon: Network,
        acesso: "gateway",
        descricao: "Registro e execução das APIs do RM.",
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    icon: UserCog,
    children: [
      {
        to: "/administracao/usuarios",
        label: "Usuários",
        icon: Users,
        acesso: "usuarios",
        descricao: "Quem tem acesso ao portal: cadastro, senha inicial, perfil de acesso e desativação.",
      },
      {
        to: "/administracao/perfis",
        label: "Perfis",
        icon: ShieldCheck,
        acesso: "usuarios",
        descricao: "O que cada perfil (Super Admin, Admin e Analista) pode fazer em cada função do portal.",
      },
      {
        to: "/administracao/logs",
        label: "Logs Gerais",
        icon: ScrollText,
        acesso: "logs",
        descricao: "Histórico de tudo que os usuários logados executam no portal.",
      },
      {
        to: "/administracao/permissoes-aplicativo",
        label: "Permissões por aplicativo",
        icon: AppWindow,
        acesso: null,
        central: true,
        descricao: "Quem pode entrar em cada aplicativo da Calper (Central de acessos, vale para todos os sistemas).",
      },
      {
        to: "/administracao/privacidade",
        label: "Privacidade",
        icon: UserX,
        acesso: "privacidade",
        descricao: "LGPD: direitos do titular, lista de descadastro, anonimização de dados e retenção automática.",
      },
    ],
  },
  {
    id: "conta",
    label: "Minha conta",
    icon: UserRound,
    children: [
      {
        to: "/conta/seguranca",
        label: "Segurança",
        icon: ShieldCheck,
        acesso: null,
        descricao: "Verificação em duas etapas (aplicativo autenticador) da sua conta.",
      },
    ],
  },
];

/** Rótulo do perfil mais alto do usuário (um usuário pode ter vários papéis). */
export function perfilPrincipal(roles: string[]): string {
  const nivel = nivelDosPapeis(roles);
  return nivel ? NIVEL_LABEL[nivel] : "Sem perfil";
}

export const visivel = (item: NavLeaf, pode: (p: Permissao) => boolean, superAdminCentral = false) =>
  item.central ? superAdminCentral : item.acesso === null || pode(item.acesso);

export function gruposVisiveis(pode: (p: Permissao) => boolean, superAdminCentral = false): NavGroup[] {
  return navGroups
    .map((g) => ({ ...g, children: g.children.filter((c) => visivel(c, pode, superAdminCentral)) }))
    .filter((g) => g.children.length > 0);
}

export function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

/** Trilha do breadcrumb para a rota atual: ["Início", grupo, página]. */
export function trilhaDe(pathname: string): string[] {
  if (isActive(pathname, homeNav.to)) return ["Início"];
  for (const g of navGroups) {
    const item = g.children.find((c) => isActive(pathname, c.to));
    if (item) return g.direto ? ["Início", g.label] : ["Início", g.label, item.label];
  }
  return ["Início"];
}
