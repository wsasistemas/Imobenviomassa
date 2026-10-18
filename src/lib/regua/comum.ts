// Régua de Cobrança — regras e formatos usados no navegador E no servidor (sem segredo, sem acesso a banco).
// Base: docs/PRD-regua-cobranca.md e docs/plano-regua-cobranca.md (decisões D1–D10).

export type Canal = "whatsapp" | "email";
export type TipoRegua = "a_vencer" | "atraso";
export type FaixaAtraso = "30" | "60" | "90" | "90+";
export type ReguaSugerida = "a_vencer" | FaixaAtraso;
export type OrigemLote = "rm" | "planilha";
export type StatusLote =
  "rascunho" | "em_processamento" | "concluido" | "concluido_com_falhas" | "cancelado";
export type StatusRegistro = "registrado" | "nao_registrado" | "nao_verificado" | "erro";
export type StatusContato = "valido" | "invalido" | "nao_localizado" | "erro" | "nao_informado";
export type StatusTentativa =
  | "pendente"
  | "processando"
  | "enviado"
  | "entregue"
  | "lido"
  | "falha"
  | "bloqueado_24h"
  | "cancelado";
export type StatusBoleto =
  | "pendente"
  | "elegivel"
  | "excecao_registro"
  | "excecao_contato"
  | "excluido"
  | "processando"
  | "sucesso"
  | "parcial"
  | "falha";
export type RegraSenha = "cpf_5_primeiros" | "cpf_4_ultimos" | "cpf_6_primeiros";

export const FAIXAS: {
  id: FaixaAtraso;
  rotulo: string;
  min: number;
  max: number | null;
  descricao: string;
}[] = [
  { id: "30", rotulo: "30 dias", min: 1, max: 30, descricao: "1 a 30 dias em atraso" },
  { id: "60", rotulo: "60 dias", min: 31, max: 60, descricao: "31 a 60 dias em atraso" },
  { id: "90", rotulo: "90 dias", min: 61, max: 90, descricao: "61 a 90 dias em atraso" },
  { id: "90+", rotulo: "Acima de 90", min: 91, max: null, descricao: "91 dias ou mais" },
];

export const ROTULO_REGUA: Record<ReguaSugerida, string> = {
  a_vencer: "A vencer",
  "30": "30 dias",
  "60": "60 dias",
  "90": "90 dias",
  "90+": "Acima de 90",
};

/** Régua do lote: "A vencer" ou a faixa de atraso. */
export function reguaDoLote(tipo: "a_vencer" | "atraso", faixa: string | null): ReguaSugerida {
  return tipo === "a_vencer" ? "a_vencer" : ((faixa ?? "30") as ReguaSugerida);
}

export const ROTULO_STATUS_LOTE: Record<StatusLote, string> = {
  rascunho: "Rascunho",
  em_processamento: "Em processamento",
  concluido: "Concluído",
  concluido_com_falhas: "Concluído com falhas",
  cancelado: "Cancelado",
};

export const ROTULO_REGISTRO: Record<StatusRegistro, string> = {
  registrado: "Registrado",
  nao_registrado: "Não registrado",
  nao_verificado: "Não verificado",
  erro: "Erro na consulta",
};

export const ROTULO_CONTATO: Record<StatusContato, string> = {
  valido: "Válido",
  invalido: "Inválido",
  nao_localizado: "Não localizado",
  erro: "Erro",
  nao_informado: "Não informado",
};

export const ROTULO_TENTATIVA: Record<StatusTentativa, string> = {
  pendente: "Na fila",
  processando: "Enviando",
  enviado: "Enviado",
  entregue: "Entregue",
  lido: "Lido",
  falha: "Falha",
  bloqueado_24h: "Trava 24 h",
  cancelado: "Cancelado",
};

export const ROTULO_BOLETO: Record<StatusBoleto, string> = {
  pendente: "Pendente",
  elegivel: "Elegível",
  excecao_registro: "Não registrado",
  excecao_contato: "Sem contato válido",
  excluido: "Excluído",
  processando: "Enviando",
  sucesso: "Sucesso",
  parcial: "Parcial",
  falha: "Falha",
};

export const ROTULO_REGRA_SENHA: Record<RegraSenha, string> = {
  cpf_5_primeiros: "5 primeiros dígitos do CPF/CNPJ",
  cpf_6_primeiros: "6 primeiros dígitos do CPF/CNPJ",
  cpf_4_ultimos: "4 últimos dígitos do CPF/CNPJ",
};

/** Campos do boleto que um template pode usar (mapa de variáveis do WhatsApp e {{variáveis}} do e-mail). */
export const CAMPOS_BOLETO = [
  { id: "nome", rotulo: "Nome do cliente" },
  { id: "primeiro_nome", rotulo: "Primeiro nome" },
  { id: "empreendimento", rotulo: "Empreendimento" },
  { id: "unidade", rotulo: "Unidade" },
  { id: "numero_boleto", rotulo: "Número do boleto" },
  { id: "vencimento", rotulo: "Vencimento" },
  { id: "dias_atraso", rotulo: "Dias em atraso" },
  { id: "valor", rotulo: "Valor" },
  { id: "linha_digitavel", rotulo: "Linha digitável" },
  { id: "link_boleto", rotulo: "Link do boleto" },
  { id: "dica_senha", rotulo: "Dica da senha do PDF" },
] as const;
export type CampoBoleto = (typeof CAMPOS_BOLETO)[number]["id"];
export const ehCampoBoleto = (v: string): v is CampoBoleto => CAMPOS_BOLETO.some((c) => c.id === v);

/** Variáveis aceitas no corpo e no assunto do e-mail. */
export const VARIAVEIS_EMAIL = CAMPOS_BOLETO.map((c) => c.id);

// ---------------------------------------------------------------- formatos

export const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** CPF ***.482.917-** e CNPJ **.381.442/0001-** (LGPD: nunca o documento inteiro na tela). */
export function mascararDocumento(doc: string | null | undefined): string {
  const d = soDigitos(doc);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  if (!d) return "—";
  return "*".repeat(Math.max(0, d.length - 3)) + d.slice(-3);
}

export function moeda(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-08-20" → "20/08/2026" (sem fuso: a data do boleto é uma data, não um instante). */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** Telefone para a Zenvia: só dígitos, com 55 para número do Brasil sem DDI. */
export function telefoneE164(bruto: string | null | undefined): string {
  const d = soDigitos(bruto);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function telefoneValido(bruto: string | null | undefined): boolean {
  const d = telefoneE164(bruto);
  // Brasil: 55 + DDD (2) + 8 ou 9 dígitos; celular começa com 9 depois do DDD.
  if (d.startsWith("55"))
    return /^55[1-9][0-9]9?[0-9]{8}$/.test(d) && d.length >= 12 && d.length <= 13;
  return /^[1-9][0-9]{9,14}$/.test(d);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailValido = (v: string | null | undefined) =>
  !!v && RE_EMAIL.test(v.trim()) && v.trim().length <= 254;

export function statusContato(canal: Canal, valor: string | null | undefined): StatusContato {
  if (!valor || !valor.trim()) return "nao_informado";
  return (canal === "whatsapp" ? telefoneValido(valor) : emailValido(valor))
    ? "valido"
    : "invalido";
}

/** Senha do PDF pela regra configurada (sempre a partir do CPF/CNPJ do boleto). */
export function senhaDoPdf(regra: RegraSenha, cpfCnpj: string | null | undefined): string | null {
  const d = soDigitos(cpfCnpj);
  if (d.length < 6) return null;
  if (regra === "cpf_4_ultimos") return d.slice(-4);
  if (regra === "cpf_6_primeiros") return d.slice(0, 6);
  return d.slice(0, 5);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Título sugerido (D6): "Atraso 60 dias · Vista Mar e Parque das Águas · Out/2026". */
export function sugerirTitulo(
  tipo: TipoRegua,
  faixa: FaixaAtraso | null,
  empreendimentos: string[],
  agora = new Date(),
): string {
  const parte1 =
    tipo === "a_vencer"
      ? "A vencer"
      : `Atraso ${faixa === "90+" ? "acima de 90 dias" : `${faixa ?? "?"} dias`}`;
  const emps =
    empreendimentos.length === 0
      ? "Todos"
      : empreendimentos.length <= 2
        ? empreendimentos.join(" e ")
        : `${empreendimentos[0]} e mais ${empreendimentos.length - 1}`;
  return `${parte1} · ${emps} · ${MESES[agora.getMonth()]}/${agora.getFullYear()}`.slice(0, 140);
}

// ---------------------------------------------------------------- mensagens

/** Valores de um boleto para preencher os templates. */
export type DadosMensagem = Record<CampoBoleto, string>;

export function dadosDaMensagem(b: {
  cliente_nome: string;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null;
  dias_atraso: number | null;
  valor: number | null;
  linha_digitavel: string | null;
  link?: string | null;
  dica: string;
}): DadosMensagem {
  return {
    nome: b.cliente_nome,
    primeiro_nome: b.cliente_nome.split(/\s+/)[0] ?? b.cliente_nome,
    empreendimento: b.empreendimento ?? "",
    unidade: b.unidade ?? "",
    numero_boleto: b.numero,
    vencimento: dataBr(b.vencimento),
    dias_atraso: b.dias_atraso != null ? String(b.dias_atraso) : "",
    valor: moeda(b.valor),
    linha_digitavel: b.linha_digitavel ?? "",
    link_boleto: b.link ?? "(link gerado no envio)",
    dica_senha: b.dica,
  };
}

/** Troca {{campo}} pelos valores. Variável desconhecida fica como está (a validação do template já barra). */
export function preencher(texto: string, dados: Partial<Record<string, string>>): string {
  return texto.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (inteiro, nome: string) => {
    const v = dados[nome.toLowerCase()];
    return v != null ? v : inteiro;
  });
}

/** Variáveis {{x}} usadas num texto. */
export function variaveisDe(texto: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const m of (texto ?? "").matchAll(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi))
    out.add(m[1].toLowerCase());
  return [...out];
}

/**
 * Campos que o WhatsApp vai mandar à Zenvia (`fields`): cada variável do template recebe o valor do campo do
 * boleto mapeado. Devolve também o texto renderizado (corpo do template com os valores) para a prévia e o log.
 */
export function montarWhatsapp(
  template: { corpo: string | null; variaveis: string[] },
  mapa: Record<string, string>,
  dados: DadosMensagem,
): { fields: Record<string, string>; texto: string; faltando: string[] } {
  const fields: Record<string, string> = {};
  const faltando: string[] = [];
  for (const v of template.variaveis) {
    const campo = mapa[v];
    if (!campo || !ehCampoBoleto(campo)) {
      faltando.push(v);
      continue;
    }
    fields[v] = dados[campo];
  }
  return { fields, texto: preencher(template.corpo ?? "", fields), faltando };
}

/** Status calculado de um template da biblioteca (só "pronto" aparece no Novo lote). */
export type ProntidaoTemplate = { pronto: true } | { pronto: false; motivo: string };

export function prontidaoWhatsapp(t: {
  ativo: boolean;
  whatsapp: { status: string; variaveis: string[]; header_tipo: string | null } | null;
  mapa_variaveis: Record<string, string>;
  usa_documento: boolean;
  remetente_id: string | null;
}): ProntidaoTemplate {
  if (!t.ativo) return { pronto: false, motivo: "Inativo" };
  if (!t.whatsapp) return { pronto: false, motivo: "Sem template Zenvia" };
  if (t.whatsapp.status !== "APPROVED")
    return { pronto: false, motivo: `Zenvia: ${rotuloStatusZenvia(t.whatsapp.status)}` };
  if (!t.remetente_id) return { pronto: false, motivo: "Sem número remetente" };
  const faltam = t.whatsapp.variaveis.filter((v) => !ehCampoBoleto(t.mapa_variaveis[v] ?? ""));
  if (faltam.length) return { pronto: false, motivo: `Variável sem campo: ${faltam.join(", ")}` };
  return { pronto: true };
}

export function prontidaoEmail(t: {
  ativo: boolean;
  assunto: string | null;
  corpo: string | null;
}): ProntidaoTemplate {
  if (!t.ativo) return { pronto: false, motivo: "Inativo" };
  if (!t.assunto?.trim() || !t.corpo?.trim())
    return { pronto: false, motivo: "Assunto ou corpo vazio" };
  const invalidas = [...variaveisDe(t.assunto), ...variaveisDe(t.corpo)].filter(
    (v) => !ehCampoBoleto(v),
  );
  if (invalidas.length)
    return { pronto: false, motivo: `Variável desconhecida: ${invalidas.join(", ")}` };
  return { pronto: true };
}

export function rotuloStatusZenvia(s: string | null | undefined): string {
  switch ((s ?? "").toUpperCase()) {
    case "APPROVED":
      return "Aprovado";
    case "PAUSED":
      return "Pausado";
    case "REJECTED":
      return "Rejeitado";
    case "DISABLED":
      return "Desativado";
    case "WAITING_REVIEW":
    case "WAITING_APPROVAL":
      return "Em análise";
    default:
      return s || "—";
  }
}

/** Texto simples → HTML seguro (o corpo do e-mail é escrito como texto; quebras viram <br>, links ficam clicáveis). */
export function textoParaHtml(texto: string): string {
  const esc = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const comLinks = esc.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222">${comLinks.replace(/\n/g, "<br>")}</div>`;
}
