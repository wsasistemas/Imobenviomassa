// Origem dos boletos da régua (PRD etapa 02) — só servidor. As duas origens viram o mesmo BoletoNormalizado
// (critério de aceite: RM e planilha geram a mesma pré-visualização para os mesmos boletos).
//
// TOTVS RM: a consulta é a API cadastrada no Gateway de APIs com o nome API.FIN.BOLETOS_A_VENCER ou
// API.FIN.BOLETOS_EM_ATRASO (só o caminho/endpoint vem do Gateway). A chamada sai daqui, do servidor da régua, com
// as credenciais de Integrações › TOTVS RM: o proxy do Gateway só aceita Admin, e o Analista de cobrança também
// monta lotes. Os filtros vão como parâmetros da consulta do RM (?parameters=DIAS_MIN=31;DIAS_MAX=60;…).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FAIXAS, soDigitos, type FaixaAtraso, type StatusRegistro, type TipoRegua } from "./comum";

export const API_A_VENCER = "API.FIN.BOLETOS_A_VENCER";
export const API_EM_ATRASO = "API.FIN.BOLETOS_EM_ATRASO";
export const LIMITE_BOLETOS = 2000;

export interface BoletoNormalizado {
  cliente_codigo: string | null;
  cliente_nome: string;
  cpf_cnpj: string | null;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null; // yyyy-mm-dd
  dias_atraso: number | null;
  valor: number | null;
  linha_digitavel: string | null;
  telefone: string | null;
  email: string | null;
  status_registro_banco: StatusRegistro;
  dados: Record<string, string>;
}

const ALIASES: Record<
  keyof Omit<BoletoNormalizado, "dados" | "status_registro_banco"> | "registrado",
  string[]
> = {
  cliente_codigo: [
    "codigo_cliente",
    "codcliente",
    "codcfo",
    "codigocliente",
    "cliente_codigo",
    "codpessoa",
  ],
  cliente_nome: [
    "nome",
    "nome_cliente",
    "nomecliente",
    "cliente",
    "nomecfo",
    "pagador",
    "nomefantasia",
  ],
  cpf_cnpj: ["cpf_cnpj", "cpfcnpj", "cpf", "cnpj", "cgccfo", "documento"],
  empreendimento: ["empreendimento", "obra", "nomeobra", "empreend", "nome_empreendimento"],
  unidade: ["unidade", "nomeunidade", "unid", "apto", "apartamento", "lote_unidade"],
  numero: [
    "numero_boleto",
    "numeroboleto",
    "nossonumero",
    "nosso_numero",
    "idboleto",
    "numerodocumento",
    "numero_documento",
    "boleto",
    "idlan",
  ],
  vencimento: ["vencimento", "data_vencimento", "datavencimento", "dtvencimento", "dataven"],
  dias_atraso: ["dias_atraso", "diasatraso", "atraso", "qtd_dias_atraso"],
  valor: [
    "valor",
    "valor_boleto",
    "valorboleto",
    "valororiginal",
    "valor_original",
    "valoratualizado",
  ],
  linha_digitavel: ["linha_digitavel", "linhadigitavel", "ipte", "linha"],
  telefone: ["whatsapp", "celular", "telefone", "fone", "telefone1", "telcelular"],
  email: ["email", "e_mail", "emailcliente", "email_cliente"],
  registrado: ["registrado", "status_registro", "statusregistro", "registro", "registrado_banco"],
};

const norm = (k: string) =>
  k
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function pegar(m: Map<string, unknown>, chaves: string[]): string | null {
  for (const k of chaves) {
    const v = m.get(norm(k));
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/** dd/mm/aaaa, aaaa-mm-dd(Thh…) ou serial do Excel → aaaa-mm-dd. */
export function dataIso(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

/** "1.234,56", "1234.56", "R$ 1.234,56" → 1234.56 */
export function numeroBr(v: string | null): number | null {
  if (!v) return null;
  let s = v.replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function registro(v: string | null): StatusRegistro {
  if (v == null) return "nao_verificado";
  const s = norm(v);
  if (["s", "sim", "1", "true", "registrado", "r"].includes(s)) return "registrado";
  if (["n", "nao", "0", "false", "naoregistrado", "pendente"].includes(s)) return "nao_registrado";
  return "nao_verificado";
}

function diasEntre(vencimento: string | null, hoje = new Date()): number | null {
  if (!vencimento) return null;
  const v = Date.parse(vencimento + "T00:00:00-03:00");
  if (Number.isNaN(v)) return null;
  const h = Date.parse(hoje.toISOString().slice(0, 10) + "T00:00:00-03:00");
  return Math.round((h - v) / 86_400_000);
}

export function normalizarLinhas(linhas: Record<string, unknown>[]): {
  boletos: BoletoNormalizado[];
  ignoradas: { linha: number; motivo: string }[];
} {
  const boletos: BoletoNormalizado[] = [];
  const ignoradas: { linha: number; motivo: string }[] = [];
  const vistos = new Set<string>();
  linhas.forEach((bruta, i) => {
    const m = new Map<string, unknown>();
    for (const [k, v] of Object.entries(bruta ?? {})) m.set(norm(k), v);
    const nome = pegar(m, ALIASES.cliente_nome);
    const numero = pegar(m, ALIASES.numero);
    if (!nome) return void ignoradas.push({ linha: i + 2, motivo: "Sem nome do cliente" });
    if (!numero) return void ignoradas.push({ linha: i + 2, motivo: "Sem número do boleto" });
    const num = numero.replace(/\s+/g, "").slice(0, 60);
    if (vistos.has(num))
      return void ignoradas.push({ linha: i + 2, motivo: `Boleto ${num} repetido` });
    vistos.add(num);
    const vencimento = dataIso(pegar(m, ALIASES.vencimento));
    const diasInformado = pegar(m, ALIASES.dias_atraso);
    const dados: Record<string, string> = {};
    for (const [k, v] of Object.entries(bruta ?? {})) {
      if (v != null && String(v).length <= 200 && !/cpf|cnpj|documento|senha|token/i.test(k))
        dados[k.slice(0, 60)] = String(v);
    }
    boletos.push({
      cliente_codigo: pegar(m, ALIASES.cliente_codigo),
      cliente_nome: nome.slice(0, 160),
      cpf_cnpj: soDigitos(pegar(m, ALIASES.cpf_cnpj)) || null,
      empreendimento: pegar(m, ALIASES.empreendimento)?.slice(0, 120) ?? null,
      unidade: pegar(m, ALIASES.unidade)?.slice(0, 60) ?? null,
      numero: num,
      vencimento,
      dias_atraso:
        diasInformado != null && /^-?\d+$/.test(diasInformado)
          ? Number(diasInformado)
          : diasEntre(vencimento),
      valor: numeroBr(pegar(m, ALIASES.valor)),
      linha_digitavel: soDigitos(pegar(m, ALIASES.linha_digitavel)) || null,
      telefone: pegar(m, ALIASES.telefone),
      email: pegar(m, ALIASES.email)?.toLowerCase() ?? null,
      status_registro_banco: registro(pegar(m, ALIASES.registrado)),
      dados,
    });
  });
  return { boletos, ignoradas };
}

export interface FiltroOrigem {
  tipoRegua: TipoRegua;
  faixa: FaixaAtraso | null;
  vencimentoDe: string | null;
  vencimentoAte: string | null;
  empreendimentos: string[];
  unidades: string[];
}

/** Aplica os filtros também depois da origem (a planilha vem inteira; o RM pode não filtrar tudo). */
export function filtrar(boletos: BoletoNormalizado[], f: FiltroOrigem): BoletoNormalizado[] {
  const faixa = f.faixa ? FAIXAS.find((x) => x.id === f.faixa) : null;
  const emps = new Set(f.empreendimentos.map(norm));
  const unids = new Set(f.unidades.map(norm));
  return boletos.filter((b) => {
    if (emps.size && !emps.has(norm(b.empreendimento ?? ""))) return false;
    if (unids.size && !unids.has(norm(b.unidade ?? ""))) return false;
    if (f.tipoRegua === "atraso") {
      if (!faixa || b.dias_atraso == null) return false;
      if (b.dias_atraso < faixa.min) return false;
      if (faixa.max != null && b.dias_atraso > faixa.max) return false;
    } else {
      if (!b.vencimento) return false;
      if (f.vencimentoDe && b.vencimento < f.vencimentoDe) return false;
      if (f.vencimentoAte && b.vencimento > f.vencimentoAte) return false;
    }
    return true;
  });
}

function extrairLinhas(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const k of ["value", "result", "rows", "data", "items", "Rows"])
      if (Array.isArray(p[k])) return p[k] as Record<string, unknown>[];
  }
  return [];
}

/** Consulta o TOTVS RM pela API cadastrada no Gateway. */
export async function buscarNoRm(
  imobiliariaId: string,
  f: FiltroOrigem,
): Promise<Record<string, unknown>[]> {
  const nomeApi = f.tipoRegua === "atraso" ? API_EM_ATRASO : API_A_VENCER;
  const { data: api } = await supabaseAdmin
    .from("api_registry")
    .select("endpoint, base_url")
    .eq("imobiliaria_id", imobiliariaId)
    .eq("name", nomeApi)
    .maybeSingle();
  if (!api)
    throw new Error(`Cadastre a API ${nomeApi} no Gateway de APIs (Configurações › Integrações).`);

  const rm = await import("@/lib/integracoes/rm.server");
  const cred = await rm.credencialRm(imobiliariaId, "compradores");
  if (!cred)
    throw new Error(
      "Integração TOTVS RM não configurada. Cadastre em Configurações › Integrações › TOTVS RM.",
    );

  // Destino: a origem do RM cadastrado (nunca uma URL livre do Gateway apontando para outro host).
  const origem = new URL(cred.endpoint).origin;
  const caminho = String(api.endpoint ?? "").trim();
  if (!caminho) throw new Error(`A API ${nomeApi} está sem endpoint no Gateway.`);
  const url = new URL(
    caminho.startsWith("http")
      ? caminho
      : `${origem}${caminho.startsWith("/") ? "" : "/"}${caminho}`,
  );
  if (url.origin !== origem)
    throw new Error(`A API ${nomeApi} aponta para outro servidor; use o mesmo do TOTVS RM.`);

  const faixa = f.faixa ? FAIXAS.find((x) => x.id === f.faixa) : null;
  const params: string[] = [];
  if (f.tipoRegua === "atraso" && faixa) {
    params.push(`DIAS_MIN=${faixa.min}`, `DIAS_MAX=${faixa.max ?? 99999}`);
  } else {
    if (f.vencimentoDe) params.push(`DATA_INI=${f.vencimentoDe}`);
    if (f.vencimentoAte) params.push(`DATA_FIM=${f.vencimentoAte}`);
  }
  const existente = url.searchParams.get("parameters");
  const todos = [existente, ...params].filter(Boolean).join(";");
  if (todos) url.searchParams.set("parameters", todos);

  const payload = await rm.buscarNoRm(url.toString(), cred);
  await rm.registrarConsultaRm(imobiliariaId, "compradores");
  return extrairLinhas(payload);
}
