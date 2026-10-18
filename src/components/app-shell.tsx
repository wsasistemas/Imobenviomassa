import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { sairDoPortal } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import {
  gruposVisiveis,
  homeNav,
  isActive,
  perfilPrincipal,
  trilhaDe,
  type NavGroup,
  type NavLeaf,
} from "@/lib/navigation";
import { toast } from "sonner";
import calperLogo from "@/assets/calper-logo.png";

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

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, email, roles, pode, souSuperAdminCentral } = useCurrentUser();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Recolhido/expandido (desktop) e menu sobreposto (telas pequenas), como no Portal DP.
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

  const role = perfilPrincipal(roles);
  const trilha = trilhaDe(pathname);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ===== Topbar ===== */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-[18px]">
        <div className="flex min-w-0 items-center gap-4">
          <IconButton onClick={toggleSidebar} aria-label="Alternar menu lateral">
            <Menu className="h-4 w-4" />
          </IconButton>
          <Link to="/home" className="flex items-center">
            <img src={calperLogo} alt="Calper — gestão compartilhada" className="block h-[26px] w-auto sm:h-8" />
          </Link>
          <div className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden whitespace-nowrap text-[12.5px] font-bold tracking-[0.02em] sm:inline">
            DISPARO EM MASSA
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:inline">{hojeLabel}</span>
          <div
            className="inline-flex h-8 items-center gap-2 rounded-lg border bg-card px-2.5 text-muted-foreground"
            title={`${formatarNome(fullName)} · ${role}${email ? ` · ${email}` : ""}`}
          >
            <UserRound className="h-3.5 w-3.5" />
            <span className="hidden flex-col leading-tight sm:flex">
              <strong className="max-w-[180px] truncate text-xs text-foreground">{formatarNome(fullName)}</strong>
              <small className="text-[10.5px]">{role}</small>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sair"
              title="Sair"
              className="ml-1 inline-flex h-[26px] w-[26px] items-center justify-center rounded-md hover:bg-primary-soft hover:text-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobileOpen && (
          <div className="fixed inset-x-0 bottom-0 top-12 z-30 bg-[rgba(15,15,20,0.45)] md:hidden" onClick={() => setMobileOpen(false)} />
        )}

        <Sidebar
          pathname={pathname}
          grupos={gruposVisiveis(pode, souSuperAdminCentral)}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCollapse={toggleSidebar}
          onNavigate={() => setMobileOpen(false)}
          onSignOut={handleSignOut}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-4 sm:px-[22px] sm:pb-9 sm:pt-[18px]">
          <Breadcrumb items={trilha} />
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
}

function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-background hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Home className="h-3 w-3" />
      {items.map((item, i) => (
        <span key={`${i}-${item}`} className={i === items.length - 1 ? "font-semibold text-foreground" : undefined}>
          {i > 0 && <span className="mr-1.5 font-normal text-muted-foreground">/</span>}
          {item}
        </span>
      ))}
    </nav>
  );
}

interface SidebarProps {
  pathname: string;
  grupos: NavGroup[];
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onNavigate: () => void;
  onSignOut: () => void;
}

function Sidebar({ pathname, grupos, collapsed, mobileOpen, onCollapse, onNavigate, onSignOut }: SidebarProps) {
  // Grupos começam fechados, exceto o que contém a página atual.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(grupos.filter((g) => g.children.some((c) => isActive(pathname, c.to))).map((g) => g.id)),
  );
  const toggleGrupo = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const itemCls = (active: boolean, sub = false) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-lg px-[11px] py-2 text-[12.5px] transition-colors",
      collapsed && "justify-center",
      sub && !collapsed && "pl-6 text-[12.5px]",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  const leaf = (item: NavLeaf, sub = false) => {
    const Icon = item.icon;
    return (
      <li key={item.to}>
        <Link to={item.to} onClick={onNavigate} title={item.label} className={itemCls(isActive(pathname, item.to), sub)}>
          <Icon className={sub ? "h-[15px] w-[15px] shrink-0" : "h-4 w-4 shrink-0"} />
          {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
        </Link>
      </li>
    );
  };

  // Grupo de item único (ex.: Centro de Treinamento) vira botão direto, com o rótulo e o ícone do grupo.
  const folhaDoGrupo = (g: NavGroup) => leaf({ ...g.children[0], label: g.label, icon: g.icon });

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col justify-between overflow-y-auto bg-sidebar px-[11px] py-3.5 transition-[width,transform] duration-200",
        // Telas pequenas: menu sobreposto que desliza da esquerda.
        "fixed bottom-0 left-0 top-12 z-40 w-[260px] -translate-x-full md:static md:translate-x-0",
        mobileOpen && "translate-x-0",
        // 240px: o maior rótulo de submenu ("Integrações TOTVS RM") cabe em uma linha, sem cortar.
        collapsed ? "md:w-14 md:items-center" : "md:w-[240px]",
      )}
    >
      <nav className="w-full">
        {!collapsed && (
          <p className="mx-[11px] mb-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground">
            Menu Principal
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {leaf(homeNav)}
          {grupos.map((g) => {
            if (g.direto) return folhaDoGrupo(g);
            // Recolhido: só os ícones das páginas, sem os cabeçalhos dos grupos.
            if (collapsed) return g.children.map((c) => leaf(c));
            const aberto = abertos.has(g.id);
            const contemAtivo = g.children.some((c) => isActive(pathname, c.to));
            const Icon = g.icon;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => toggleGrupo(g.id)}
                  aria-expanded={aberto}
                  title={g.label}
                  className={itemCls(contemAtivo && !aberto)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left leading-tight">{g.label}</span>
                  <ChevronRight
                    className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", aberto && "rotate-90")}
                  />
                </button>
                {aberto && <ul className="mb-1.5 mt-0.5 flex flex-col gap-0.5">{g.children.map((c) => leaf(c, true))}</ul>}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 flex w-full flex-col gap-0.5 border-t border-sidebar-border pt-3">
        <button type="button" onClick={onCollapse} className={cn(itemCls(false), "hidden md:flex")}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher menu</span>}
        </button>
        <button type="button" onClick={onSignOut} className={itemCls(false)}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
