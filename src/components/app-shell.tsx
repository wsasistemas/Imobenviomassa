import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronRight, Home, LogOut, Menu } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { sairDoPortal } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import {
  ancestorsOf,
  getMenuItem,
  menuChildrenOf,
  menuGroups,
  menuItemForPath,
  menuItemsByGroup,
  trilhaDe,
  type MenuItem,
  type PermissionId,
} from "@/config/menu-registry";
import { IconeDoMenu } from "@/components/icones/icone-colorido";
import { toast } from "sonner";
import wsaLogo from "@/assets/wsa-logo.png";

const hojeLabel = new Date().toLocaleDateString("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Nome para exibição. Perfis sem nome cadastrado trazem o e-mail no lugar:
 * "nathan.santos@calper.com.br" → "Nathan Santos".
 */
export function formatarNome(name: string | null) {
  const base = (name ?? "").trim().split("@")[0];
  if (!base) return "Usuário";
  return base
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p, i) => (i > 0 && ["de", "da", "do", "das", "dos", "e"].includes(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

export function iniciais(name: string | null) {
  const partes = formatarNome(name).split(" ").filter((p) => p.length > 2 || p === p.toLocaleUpperCase("pt-BR"));
  return ((partes[0]?.[0] ?? "U") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toLocaleUpperCase("pt-BR");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, email, perfilNome, imobiliariaNome, canOpen } = useCurrentUser();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Recolhido/expandido (desktop) e menu sobreposto (telas pequenas), como no Portal_Atendimento.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setCollapsed(false);
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  async function handleSignOut() {
    // Logout centralizado: limpa rascunho do wizard, caches locais e React Query,
    // encerra a sessão só neste navegador e recarrega em /auth.
    toast.success("Até logo!");
    await sairDoPortal({ queryClient });
  }

  const role = perfilNome ?? "Sem perfil";
  const nome = formatarNome(fullName);

  return (
    <div className="flex h-screen bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-[oklch(0.24_0.03_255/0.45)] md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        pathname={pathname}
        canOpen={canOpen}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={toggleSidebar}
        onNavigate={() => setMobileOpen(false)}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== Cabeçalho ===== */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Alternar menu lateral"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Breadcrumb items={trilhaDe(pathname)} />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:inline">{hojeLabel}</span>
            <div
              className="inline-flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-1.5 sm:pr-2"
              title={`${nome} · ${role}${imobiliariaNome ? ` · ${imobiliariaNome}` : ""}${email ? ` · ${email}` : ""}`}
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary-soft text-[11.5px] font-bold text-primary-dark">
                {iniciais(fullName)}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <strong className="max-w-[180px] truncate text-[12.5px]">{nome}</strong>
                <small className="text-[11px] text-muted-foreground">{role}</small>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sair"
                title="Sair"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary-soft hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-6 sm:pt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
      <Home className="h-3.5 w-3.5 shrink-0" />
      {items.map((item, i) => (
        <span key={`${i}-${item}`} className={cn("truncate", i === items.length - 1 && "font-semibold text-foreground")}>
          {i > 0 && <span className="mr-1.5 font-normal text-dimmer">/</span>}
          {item}
        </span>
      ))}
    </nav>
  );
}

interface SidebarProps {
  pathname: string;
  canOpen: (id: PermissionId) => boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onNavigate: () => void;
  onSignOut: () => void;
}

function Sidebar({ pathname, canOpen, collapsed, mobileOpen, onCollapse, onNavigate, onSignOut }: SidebarProps) {
  const ativo = menuItemForPath(pathname);
  const cadeiaAtiva = new Set(ativo ? ancestorsOf(ativo.id).map((m) => m.id) : []);

  // Grupos começam fechados, exceto os que contêm a página atual.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(cadeiaAtiva));
  const toggleGrupo = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Subitens visíveis na sidebar (sem as seções, que são abas da tela do pai). */
  const filhos = (item: MenuItem) => menuChildrenOf(item.id).filter((c) => !c.section && canOpen(c.id));

  const itemCls = (on: boolean, depth: number, grupoAtivo = false) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg py-2 text-left text-[13.5px] font-medium transition-colors",
      collapsed ? "justify-center px-0" : depth === 0 ? "px-2.5" : depth === 1 ? "pl-8 pr-2.5 text-[13px]" : "pl-[52px] pr-2.5 text-[13px]",
      on
        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-brand"
        : grupoAtivo
          ? "font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  const renderItem = (item: MenuItem, depth: number): ReactNode => {
    const sub = filhos(item);
    const tamanho = depth === 0 ? 20 : 18;

    // Agrupador (sem tela própria): botão que abre/fecha os subitens.
    if (!item.path) {
      if (sub.length === 0) return null;
      // Recolhido: só os ícones das páginas, sem os cabeçalhos dos grupos.
      if (collapsed) return sub.map((c) => renderItem(c, depth + 1));
      const aberto = abertos.has(item.id);
      return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => toggleGrupo(item.id)}
            aria-expanded={aberto}
            title={item.label}
            className={itemCls(false, depth, cadeiaAtiva.has(item.id))}
          >
            <IconeDoMenu id={item.id} icon={item.icon} tamanho={tamanho} />
            <span className="flex-1 truncate">{item.label}</span>
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 opacity-50 transition-transform", aberto && "rotate-90")} />
          </button>
          {aberto && <ul className="mt-0.5 flex flex-col gap-0.5">{sub.map((c) => renderItem(c, depth + 1))}</ul>}
        </li>
      );
    }

    return (
      <li key={item.id}>
        <Link
          to={item.path}
          onClick={onNavigate}
          title={item.label}
          className={itemCls(ativo?.id === item.id || (cadeiaAtiva.has(item.id) && !!ativo?.section), collapsed ? 0 : depth)}
        >
          <IconeDoMenu id={item.id} icon={item.icon} tamanho={tamanho} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        </Link>
      </li>
    );
  };

  const seguranca = getMenuItem("conta_seguranca");

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r bg-sidebar transition-[width,transform] duration-200",
        // Telas pequenas: menu sobreposto que desliza da esquerda.
        "fixed inset-y-0 left-0 z-40 w-[268px] -translate-x-full md:static md:translate-x-0",
        mobileOpen && "translate-x-0",
        collapsed ? "md:w-[68px]" : "md:w-[260px]",
      )}
    >
      <Link
        to="/home"
        onClick={onNavigate}
        className={cn("flex h-16 shrink-0 items-center gap-2.5 px-4", collapsed && "md:justify-center md:px-0")}
      >
        <img src={wsaLogo} alt="WSA Sistemas IA" className="h-10 w-10 shrink-0 rounded-full shadow-card" />
        {!collapsed && (
          <span className="leading-tight">
            <strong className="block text-[15px] font-extrabold tracking-[-0.01em]">Disparo em Massa</strong>
            <small className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              WSA Sistemas
            </small>
          </span>
        )}
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {menuGroups.map((g) => {
          const itens = menuItemsByGroup(g.id).filter((m) => canOpen(m.id));
          if (itens.length === 0) return null;
          return (
            <div key={g.id}>
              {!collapsed && (
                <p className="px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {g.label}
                </p>
              )}
              {collapsed && <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />}
              <ul className="flex flex-col gap-0.5">{itens.map((m) => renderItem(m, 0))}</ul>
            </div>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border px-3 py-2.5">
        <button type="button" onClick={onCollapse} className={cn(itemCls(false, 0), "hidden md:flex")} title="Recolher menu">
          <IconeDoMenu id={collapsed ? "rodape_expandir" : "rodape_recolher"} tamanho={20} />
          {!collapsed && <span>{collapsed ? "Expandir menu" : "Recolher menu"}</span>}
        </button>
        {seguranca?.path && (
          <Link to={seguranca.path} onClick={onNavigate} title={seguranca.label} className={itemCls(ativo?.id === seguranca.id, 0)}>
            <IconeDoMenu id={seguranca.id} icon={seguranca.icon} tamanho={20} />
            {!collapsed && <span>{seguranca.label}</span>}
          </Link>
        )}
        <button type="button" onClick={onSignOut} className={itemCls(false, 0)} title="Sair">
          <IconeDoMenu id="rodape_sair" tamanho={20} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
