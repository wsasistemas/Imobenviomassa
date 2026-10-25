import { ChevronLeft, ChevronRight, LogOut, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { COR_DO_ICONE, COR_DO_MENU, corVar, type CorSistema } from "./cores";

// Ícones no padrão /apple-hig-designer (24/10/2026, docs/plano-login-e-icones-hig.md): o símbolo Lucide faz o papel
// do SF Symbols. Menu = símbolo branco no tile sólido (.hig-tile); indicadores = tile tingido (.hig-tint).
// Botões de ação e campos usam só o símbolo de linha, sem estes componentes.

const SIMBOLO_DO_RODAPE: Record<string, LucideIcon> = {
  rodape_recolher: ChevronLeft,
  rodape_expandir: ChevronRight,
  rodape_sair: LogOut,
};

const estiloTile = (lado: number, cor: CorSistema): CSSProperties =>
  ({ width: lado, height: lado, "--c": corVar(cor) }) as CSSProperties;

/**
 * Ícone do item do menu (sidebar, cards, matriz), pelo id do menu-registry: símbolo branco no tile da cor do item.
 * `tamanho` é o do símbolo de antes; o tile fica 4 px maior.
 */
export function IconeDoMenu({
  id,
  icon,
  tamanho = 20,
  className,
}: {
  id: string;
  icon?: LucideIcon;
  tamanho?: number;
  className?: string;
}) {
  const Simbolo = icon ?? SIMBOLO_DO_RODAPE[id];
  if (!Simbolo) return null;
  const lado = tamanho + 4;
  return (
    <span className={cn("hig-tile", className)} style={estiloTile(lado, COR_DO_MENU[id] ?? "blue")} aria-hidden="true">
      <Simbolo size={Math.round(lado * 0.6)} strokeWidth={2.2} />
    </span>
  );
}

/** Ícone ilustrativo (KPIs, cabeçalhos, telas vazias): símbolo na cor sobre o tile tingido. `size` = lado do tile. */
export function IconeIlustrativo({
  icon: Simbolo,
  size,
  cor,
  className,
}: {
  icon: LucideIcon;
  size: number;
  cor?: CorSistema;
  className?: string;
}) {
  return (
    <span className={cn("hig-tint", className)} style={estiloTile(size, cor ?? COR_DO_ICONE.get(Simbolo) ?? "blue")} aria-hidden="true">
      <Simbolo size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}
