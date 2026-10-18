// Máscaras de dados pessoais para telas, relatórios e exportações (LGPD / minimização).
// Sem dependência de servidor: pode ser importado por *.functions.ts e por componentes.
// CPF/CNPJ: use `mascararDocumento` de "@/lib/csv".

/** E-mail com só a 1ª letra do usuário visível: "joao.silva@calper.com.br" → "j***@calper.com.br". */
export function mascararEmail(e: string | null | undefined): string {
  const t = (e ?? "").trim();
  if (!t) return "";
  const arroba = t.lastIndexOf("@");
  if (arroba < 1) return "***";
  return `${t[0]}***${t.slice(arroba)}`;
}

/** Telefone com só os 4 últimos dígitos visíveis: "21999991234" → "(**) *****-1234". */
export function mascararTelefone(t: string | null | undefined): string {
  let d = (t ?? "").replace(/\D/g, "");
  if (!d) return "";
  // DDI do Brasil (55 + DDD + número com 8 ou 9 dígitos).
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length < 8) return "*".repeat(Math.max(0, d.length - 2)) + d.slice(-2);
  const fim = d.slice(-4);
  if (d.length === 10) return `(**) ****-${fim}`;
  if (d.length === 11) return `(**) *****-${fim}`;
  return `${"*".repeat(d.length - 4)}${fim}`;
}
