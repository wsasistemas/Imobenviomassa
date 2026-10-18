// Normalização dos identificadores da lista de descadastro (opt-out) — Fase 4 / LGPD.
// Usada pelo servidor (criação de campanha, tela de Privacidade) e pelas telas. Sem dependência de servidor.

export const TIPOS_OPT_OUT = ["cpf", "email", "telefone"] as const;
export type TipoOptOut = (typeof TIPOS_OPT_OUT)[number];

export const ROTULO_TIPO_OPT_OUT: Record<TipoOptOut, string> = {
  cpf: "CPF/CNPJ",
  email: "E-mail",
  telefone: "Telefone",
};

/**
 * Valor no formato gravado em wa_opt_outs.valor: CPF/CNPJ e telefone só com dígitos (telefone sem o
 * 55 inicial quando tem 12 ou 13 dígitos, para casar "5521999990000" com "21999990000"); e-mail em
 * minúsculas. Devolve null se o valor é vazio ou inválido para o tipo.
 */
export function normalizarOptOut(tipo: TipoOptOut, valor: unknown): string | null {
  const bruto = typeof valor === "string" ? valor.trim() : "";
  if (!bruto) return null;
  if (tipo === "email") {
    const e = bruto.toLowerCase();
    return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
  }
  const digitos = bruto.replace(/\D/g, "");
  if (tipo === "cpf") return digitos.length === 11 || digitos.length === 14 ? digitos : null;
  // telefone
  const semPais = (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return semPais.length === 10 || semPais.length === 11 ? semPais : null;
}

/** Os três identificadores de um destinatário, já normalizados (null onde ausente/inválido). */
export function identificadoresNormalizados(d: {
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
}): { cpf: string | null; email: string | null; telefone: string | null } {
  return {
    cpf: normalizarOptOut("cpf", d.cpf),
    email: normalizarOptOut("email", d.email),
    telefone: normalizarOptOut("telefone", d.telefone),
  };
}
