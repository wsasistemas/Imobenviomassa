import { addIcon, Icon } from "@iconify/react";
import type { LucideIcon } from "lucide-react";
import { COLORIDO_DE, DADOS_COLORIDOS, ICONE_DO_MENU } from "./icones.data";

// Ícones coloridos (Iconify) embutidos no bundle: a CSP não deixa buscar na API. Gerados por `npm run icones`.
// Só o menu e os ícones ilustrativos ficam coloridos; botões de ação continuam com o ícone de linha (padrão do
// Portal_Atendimento).

for (const [nome, data] of Object.entries(DADOS_COLORIDOS)) addIcon(nome, data);

/** Ícone do item do menu (sidebar, cards, matriz), pelo id do menu-registry; sem colorido, o próprio Lucide. */
export function IconeDoMenu({
  id,
  icon: Linha,
  tamanho = 20,
  className,
}: {
  id: string;
  icon?: LucideIcon;
  tamanho?: number;
  className?: string;
}) {
  const nome = ICONE_DO_MENU[id];
  if (nome) return <Icon icon={nome} width={tamanho} height={tamanho} className={className} aria-hidden="true" />;
  return Linha ? <Linha size={tamanho - 2} className={className} aria-hidden="true" /> : null;
}

/** Ícone ilustrativo de tela: o colorido equivalente ao Lucide; sem equivalente, o próprio Lucide. */
export function IconeIlustrativo({ icon: Linha, size, className }: { icon: LucideIcon; size: number; className?: string }) {
  const nome = COLORIDO_DE.get(Linha);
  if (!nome) return <Linha size={size} className={className} aria-hidden="true" />;
  return <Icon icon={nome} width={size + 2} height={size + 2} className={className} aria-hidden="true" />;
}
