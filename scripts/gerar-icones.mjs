// Gera src/components/icones/icones.data.ts com os ícones coloridos (Iconify), embutidos no bundle: o <Icon> do Iconify
// buscaria na api.iconify.design, e a CSP do portal (connect-src) bloqueia. Mesmo modelo do Portal_Atendimento.
// Para incluir um ícone: some nas listas abaixo e rode `npm run icones`.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Menu lateral, cards e matriz de permissões: ícone colorido de cada item, pelo id do menu-registry.
const MENU = [
  ["home", "fluent-color:home-24"],
  ["disparos", "fluent-color:send-24"],
  ["docusign", "flat-color-icons:signature"],
  ["ver_dashboard", "flat-color-icons:combo-chart"],
  ["criar_disparo", "fluent-color:send-24"],
  ["ver_historico", "fluent-color:history-24"],
  ["ver_relatorios", "flat-color-icons:bar-chart"],
  ["regua_cobranca", "flat-color-icons:money-transfer"],
  ["treinamento", "flat-color-icons:graduation-cap"],
  ["configuracoes", "fluent-color:settings-24"],
  ["manage_users", "fluent-color:people-24"],
  ["manage_permissions", "fluent-color:person-key-24"],
  ["manage_app_access", "fluent-color:lock-shield-24"],
  ["configure_integrations", "flat-color-icons:data-configuration"],
  ["integracao_totvs", "flat-color-icons:data-configuration"],
  ["integracao_docusign", "flat-color-icons:signature"],
  ["gateway_apis", "flat-color-icons:workflow"],
  ["gerenciar_credenciais", "flat-color-icons:key"],
  ["view_audit_logs", "fluent-color:text-bullet-list-square-24"],
  ["manage_privacy", "flat-color-icons:privacy"],
  ["manage_sessions", "fluent-color:shield-checkmark-24"],
  ["conta_seguranca", "flat-color-icons:key"],
  // Rodapé do menu (ids próprios, fora do registro).
  ["rodape_recolher", "flat-color-icons:previous"],
  ["rodape_expandir", "flat-color-icons:next"],
  ["rodape_sair", "flat-color-icons:export"],
  ["em_construcao", "fluent-color:calendar-clock-24"],
];

// Ícones ilustrativos das telas (KPIs, cabeçalhos, telas vazias): o Lucide que a tela já usa → o colorido.
// Botões de ação continuam com ícone de linha (regra do Portal_Atendimento, 16/10/2026).
const LUCIDE = [
  ["BarChart3", "flat-color-icons:bar-chart"],
  ["CalendarClock", "fluent-color:calendar-clock-24"],
  ["CircleCheckBig", "fluent-color:checkmark-circle-24"],
  ["Clock", "fluent-color:clock-24"],
  ["FileText", "fluent-color:document-text-24"],
  ["History", "fluent-color:history-24"],
  ["Info", "flat-color-icons:info"],
  ["LayoutDashboard", "flat-color-icons:combo-chart"],
  ["Lock", "fluent-color:lock-closed-24"],
  ["Mail", "fluent-color:mail-24"],
  ["Megaphone", "fluent-color:megaphone-loud-24"],
  ["Send", "fluent-color:send-24"],
  ["ShieldCheck", "fluent-color:shield-checkmark-24"],
  ["TrendingUp", "fluent-color:data-trending-24"],
  ["Users", "fluent-color:people-24"],
  ["XCircle", "fluent-color:dismiss-circle-24"],
];

const colecoes = new Map();
const dadosDe = (nome) => {
  const [prefixo, icone] = nome.split(":");
  if (!colecoes.has(prefixo)) colecoes.set(prefixo, JSON.parse(readFileSync(require.resolve(`@iconify-json/${prefixo}/icons.json`), "utf8")));
  const c = colecoes.get(prefixo);
  const i = c.icons[icone];
  if (!i) throw new Error(`Ícone não existe: ${nome}`);
  return { body: i.body, width: i.width ?? c.width ?? 16, height: i.height ?? c.height ?? 16 };
};

const usados = [...new Set([...MENU.map(([, n]) => n), ...LUCIDE.map(([, n]) => n)])];
writeFileSync(
  new URL("../src/components/icones/icones.data.ts", import.meta.url),
  `// Gerado por scripts/gerar-icones.mjs (npm run icones). Não edite à mão.
import type { IconifyIcon } from "@iconify/react";
import { ${LUCIDE.map(([l]) => l).join(", ")}, type LucideIcon } from "lucide-react";

/** Ícone colorido de cada item do menu, pelo id do menu-registry. */
export const ICONE_DO_MENU: Record<string, string> = ${JSON.stringify(Object.fromEntries(MENU), null, 2)};

/** Ícone Lucide ilustrativo → nome do colorido. */
export const COLORIDO_DE = new Map<LucideIcon, string>([
${LUCIDE.map(([l, n]) => `  [${l}, ${JSON.stringify(n)}],`).join("\n")}
]);

export const DADOS_COLORIDOS: Record<string, IconifyIcon> = ${JSON.stringify(Object.fromEntries(usados.map((n) => [n, dadosDe(n)])), null, 2)};
`,
);
console.log(`${MENU.length} ícones do menu e ${LUCIDE.length} das telas gravados (${usados.length} desenhos).`);
