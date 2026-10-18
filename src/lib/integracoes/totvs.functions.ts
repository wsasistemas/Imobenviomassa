import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirAal2, exigirPapel, temPapel } from "@/lib/authz";
import type { RecursoRm, StatusRm } from "./rm.server";

// ---------- Validação de entrada (auditoria de segurança, Fase 2 / N4) ----------
// Mesmo padrão de src/lib/campanhas.functions.ts: input `unknown` → zod → só os campos do schema
// chegam ao handler (strip por padrão).

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

// Espelha RECURSOS_RM de ./rm.server (que só pode ser carregado com import dinâmico, no servidor).
// O handler ainda confere com rm.ehRecursoRm, a fonte da verdade.
const recursoRmSchema = z.enum(["empreendimentos", "compradores"], {
  errorMap: () => ({ message: "Integração desconhecida." }),
});

const credenciaisRmSchema = z.object({
  recurso: recursoRmSchema,
  endpoint: z
    .string({ required_error: "Informe o endpoint." })
    .trim()
    .min(1, "Informe o endpoint.")
    .max(500, "Endpoint muito longo.")
    .regex(/^https:\/\//i, "Informe o endpoint completo, começando com https://"),
  usuario: z.string({ required_error: "Informe o usuário." }).trim().min(1, "Informe o usuário.").max(100, "Usuário muito longo."),
  senha: z.string().max(200, "Senha muito longa.").optional(),
});

// Código do empreendimento vai para a query do RM (?parameters=CODCOLIGADA=…): só [A-Za-z0-9_.-].
const empreendimentoIdSchema = z
  .string({ required_error: "Empreendimento não informado." })
  .trim()
  .min(1, "Empreendimento não informado.")
  .max(100, "Código de empreendimento muito longo.")
  .regex(/^[\w.-]+$/, "Código de empreendimento inválido.");

function hostDaUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Integração com o TOTVS RM. As credenciais e a chamada ao RM ficam em ./rm.server (só servidor);
// este arquivo expõe as server functions usadas pelas telas. Carregue ./rm.server com import dinâmico:
// *.functions.ts também vai para o bundle do navegador.

export type { RecursoRm, StatusRm };

export const ROTULO_RECURSO_RM: Record<RecursoRm, string> = {
  empreendimentos: "Empreendimentos",
  compradores: "Compradores",
};

export type EmpreendimentoTotvs = {
  id: string;
  codigo: string;
  nome: string;
  subtitulo: string;
};

export type ContratoTotvs = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  empreendimento: string;
  bloco: string;
  unidade: string;
  situacao: string;
  dados_extras?: Record<string, string>;
};

export type TesteConexaoRm = {
  ok: boolean;
  msg: string;
  registros?: number;
  campos?: string[];
};

type Contexto = {
  supabase: any;
  userId: string;
  claims?: { email?: string };
};

const NAO_CONFIGURADO = "Integração TOTVS RM não configurada. Cadastre em Configurações → Integrações TOTVS RM.";

async function exigirAdmin(context: Contexto) {
  await exigirPapel(context, ["admin", "super_admin"], "Só Admin e Super Admin usam as integrações com o TOTVS RM.");
}

// Os dados do RM trazem CPF, telefone e e-mail dos compradores: contas sem papel de
// trabalho (ex.: "cliente", o padrão de quem acabou de se cadastrar) não podem ler.
async function exigirOperacao(context: Contexto) {
  await exigirPapel(
    context,
    ["operadora", "admin", "super_admin"],
    "Seu perfil ainda não tem acesso aos dados do TOTVS RM. Solicite o papel de operadora a um administrador.",
  );
}

// Cache em memória por instância (TTL curto): vários usuários abrindo o wizard em sequência não
// repetem a consulta ao RM.
type CacheEntry<T> = { at: number; value: T };
const memCache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60_000;

function cacheGet<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet<T>(key: string, value: T): void {
  memCache.set(key, { at: Date.now(), value });
}

// Extrai as linhas do payload do RM (RealizaConsulta vem em várias formas).
function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["value", "result", "rows", "data", "items", "Rows"]) {
      const v = p[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
    // às vezes vem { "0": {...}, "1": {...} }
    const numeric = Object.keys(p).filter((k) => /^\d+$/.test(k));
    if (numeric.length > 0) return numeric.map((k) => p[k] as Record<string, unknown>);
  }
  return [];
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRow(row: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const k of Object.keys(row)) m.set(normKey(k), row[k]);
  return m;
}

function pickFromMap(map: Map<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const v = map.get(normKey(key));
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return fallback;
}

function mapEmpreendimentos(rows: Record<string, unknown>[]): EmpreendimentoTotvs[] {
  return rows.map((r, i) => {
    const m = normalizeRow(r);
    const codigo = pickFromMap(m, ["codigo", "cod", "codcoligada", "codobra", "idobra", "id", "codemp"]);
    const nome = pickFromMap(m, ["nome", "descricao", "nomeobra", "empreendimento", "razaosocial"]);
    const subtitulo = pickFromMap(m, ["subtitulo", "complemento", "fantasia", "grupo", "cidade", "bairro"]);
    return {
      id: codigo || String(i + 1),
      codigo: codigo || String(i + 1),
      nome: nome || `Empreendimento ${i + 1}`,
      subtitulo,
    };
  });
}

/**
 * Colunas do RM que podem seguir em `dados_extras` para o navegador — LGPD (art. 6º, III, minimização)
 * e auditoria N9. Antes TODAS as colunas do RM (CPF do cônjuge, renda, endereço…) iam para o
 * navegador e para o rascunho em sessionStorage; agora só passa o que as telas do disparo usam:
 * a detecção do comprador "principal" (disparo.novo.compradores.tsx e disparo.novo.revisao.tsx).
 * As chaves são as de `normKey` (minúsculas, só [a-z0-9]).
 *
 * `campanhas.functions.ts` (EXTRAS_PERMITIDOS) só grava `nome_conjuge`, `email_conjuge`,
 * `telefone_conjuge` e `cpf_conjuge`. Como `normKey` remove o "_", uma coluna do RM nunca chega com
 * esse nome (hoje esses dados só vêm da planilha Excel, que não passa por aqui); se o RM passar a
 * fornecê-los, é preciso adicioná-los aqui (sem "_") e converter para as chaves de EXTRAS_PERMITIDOS.
 */
export const EXTRAS_RM_PERMITIDOS = [
  "principal",
  "titular",
  "compradorprincipal",
  "titularprincipal",
  "flagprincipal",
  "indprincipal",
  "indicadorprincipal",
  "tipocliente",
  "tipocomprador",
  "tipopessoa",
  "papel",
  "funcao",
] as const;

// Colunas cujo NOME segue o critério das telas para "principal" (/principal|titular/ e
// /tipo.*(cliente|comprador|pessoa)|papel|funcao/) mas não estão na lista fixa acima. Nunca inclui
// colunas de dado pessoal (ex.: "cpftitular", "nometitular", "emailtitular").
const PADRAO_EXTRA_PRINCIPAL = /principal|titular|tipo.*(cliente|comprador|pessoa)|papel|funcao/;
const PADRAO_DADO_PESSOAL = /cpf|cnpj|nome|mail|fone|telef|celular|whats|doc|rg$|nasc|ender|cep|renda|salario/;
const EXTRA_VALOR_MAX = 60;

function extraPermitido(chave: string): boolean {
  if ((EXTRAS_RM_PERMITIDOS as readonly string[]).includes(chave)) return true;
  return PADRAO_EXTRA_PRINCIPAL.test(chave) && !PADRAO_DADO_PESSOAL.test(chave);
}

function mapContratos(rows: Record<string, unknown>[], empreendimentoId: string): ContratoTotvs[] {
  return rows.map((r, i) => {
    const m = normalizeRow(r);
    const extras: Record<string, string> = {};
    for (const [k, v] of m.entries()) {
      if (v !== null && v !== undefined && extraPermitido(k)) extras[k] = String(v).trim().slice(0, EXTRA_VALOR_MAX);
    }
    return {
      id: pickFromMap(m, ["idcontrato", "contrato", "id", "codcontrato", "numerocontrato", "nrcontrato"]) || `T-${empreendimentoId}-${i}`,
      nome: pickFromMap(m, ["nome", "comprador", "cliente", "razaosocial", "nomecliente", "nomecomprador"]),
      cpf: pickFromMap(m, ["cpf", "cnpjcpf", "cpfcnpj", "cpf_cnpj", "documento", "numerocpf", "nrcpf", "nrocpf", "cpfcliente", "documentocliente"]),
      telefone: pickFromMap(m, ["telefone", "celular", "whatsapp", "fone", "numerotelefone", "numerocelular", "telefonecelular", "telefone1"]),
      email: pickFromMap(m, ["email", "e-mail", "emailcliente"]),
      empreendimento: pickFromMap(m, ["empreendimento", "nomeobra", "obra", "nomeempreendimento", "descricaoempreendimento", "descricao", "nomecomercial", "nomeprojeto", "projeto", "obra_nome", "nome_obra"]),
      bloco: pickFromMap(m, ["bloco", "torre", "nrbloco", "numerobloco", "codbloco"]),
      unidade: pickFromMap(m, ["unidade", "apto", "apartamento", "numero", "nrunidade", "numerounidade", "numeroap", "numeroapt", "codunidade"]),
      situacao: pickFromMap(m, ["situacao", "status"], "Ativo"),
      dados_extras: extras,
    };
  });
}

export const listarEmpreendimentosTotvs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => validar(z.object({ forceRefresh: z.boolean().optional() }).optional())(input) ?? {})
  .handler(
    async ({ data, context }): Promise<{
      empreendimentos: EmpreendimentoTotvs[];
      error?: string;
      fetchedAt?: string;
      fromCache?: boolean;
      count?: number;
    }> => {
      await exigirOperacao(context as unknown as Contexto);
      const rm = await import("./rm.server");
      try {
        const cred = await rm.credencialRm("empreendimentos");
        if (!cred) return { empreendimentos: [], error: NAO_CONFIGURADO };

        const cacheKey = `emp:${cred.endpoint}:${cred.usuario}`;
        if (data?.forceRefresh) memCache.delete(cacheKey);
        const cached = cacheGet<{ empreendimentos: EmpreendimentoTotvs[]; fetchedAt: string }>(cacheKey);
        if (cached) {
          return { ...cached, fromCache: true, count: cached.empreendimentos.length };
        }

        const empreendimentos = mapEmpreendimentos(extractRows(await rm.buscarNoRm(cred.endpoint, cred)));
        const fetchedAt = new Date().toISOString();
        cacheSet(cacheKey, { empreendimentos, fetchedAt });
        void rm.registrarConsultaRm("empreendimentos").catch(() => undefined);
        return { empreendimentos, fetchedAt, fromCache: false, count: empreendimentos.length };
      } catch (e) {
        return { empreendimentos: [], error: e instanceof Error ? e.message : "Erro desconhecido ao consultar o TOTVS RM" };
      }
    },
  );

export const buscarCompradoresPorEmpreendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ empreendimento_id: empreendimentoIdSchema })))
  .handler(async ({ data, context }): Promise<{ contratos: ContratoTotvs[]; error?: string }> => {
    await exigirOperacao(context as unknown as Contexto);
    const rm = await import("./rm.server");
    try {
      const cred = await rm.credencialRm("compradores");
      if (!cred) return { contratos: [], error: NAO_CONFIGURADO };
      // GET {endpoint}?parameters=CODCOLIGADA={codigo do empreendimento}
      // `empreendimento_id` já passou pelo regex acima; rm.urlCompradores aplica encodeURIComponent
      // (não encodar aqui para não codificar duas vezes).
      const payload = await rm.buscarNoRm(rm.urlCompradores(cred.endpoint, data.empreendimento_id), cred);
      const contratos = mapContratos(extractRows(payload), data.empreendimento_id);
      void rm.registrarConsultaRm("compradores").catch(() => undefined);
      return { contratos };
    } catch (e) {
      return { contratos: [], error: e instanceof Error ? e.message : "Erro desconhecido ao consultar o TOTVS RM" };
    }
  });

/** Situação das integrações (nunca devolve a senha). `status` é null enquanto a migração não rodou. */
export const statusIntegracaoRm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: StatusRm[] | null; superAdmin: boolean }> => {
    const ctx = context as unknown as Contexto;
    await exigirAdmin(ctx);
    const rm = await import("./rm.server");
    const [status, superAdmin] = await Promise.all([rm.statusRm(), temPapel(ctx, ["super_admin"])]);
    return { status, superAdmin };
  });

/**
 * Grava o endpoint da integração e o usuário/senha (comuns). Senha em branco mantém a atual.
 *
 * Endpoint: só https. Host do endpoint:
 *   · com RM_HOSTS_PERMITIDOS (lista separada por vírgula) → precisa estar na lista;
 *   · sem a variável → precisa ser o mesmo host já cadastrado em outro recurso; se nenhum outro
 *     estiver cadastrado (primeiro cadastro), aceita e registra `primeiro_cadastro: true` na auditoria.
 * Evita que um Super Admin comprometido aponte o portal (e o usuário/senha do RM) para um servidor externo.
 */
export const salvarCredenciaisRm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(credenciaisRmSchema, "Dados da integração inválidos."))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ctx = context as unknown as Contexto;
    if (!(await temPapel(ctx, ["super_admin"]))) {
      throw new Error("Só um Super Admin altera as credenciais do TOTVS RM.");
    }
    await exigirAal2(ctx); // segundo fator (TOTP) obrigatório para mexer em credenciais
    const rm = await import("./rm.server");
    if (!rm.ehRecursoRm(data.recurso)) throw new Error("Integração desconhecida.");
    const endpoint = data.endpoint;
    const host = hostDaUrl(endpoint);
    if (!host) throw new Error("Informe o endpoint completo, começando com https://");

    let primeiroCadastro = false;
    const hostsPermitidos = (process.env.RM_HOSTS_PERMITIDOS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (hostsPermitidos.length > 0) {
      if (!hostsPermitidos.includes(host)) {
        throw new Error(`O host "${host}" não está na lista de hosts permitidos do TOTVS RM (RM_HOSTS_PERMITIDOS).`);
      }
    } else {
      const outrosHosts = ((await rm.statusRm()) ?? [])
        .filter((s) => s.recurso !== data.recurso && s.endpoint)
        .map((s) => hostDaUrl(s.endpoint))
        .filter((h): h is string => Boolean(h));
      if (outrosHosts.length === 0) {
        primeiroCadastro = true;
      } else if (!outrosHosts.includes(host)) {
        throw new Error(
          `O host "${host}" é diferente do já cadastrado para o TOTVS RM (${outrosHosts[0]}). ` +
            "Para usar outro servidor, defina RM_HOSTS_PERMITIDOS no ambiente.",
        );
      }
    }

    const autor = ctx.claims?.email ?? ctx.userId;
    await rm.salvarCredencialRm({
      recurso: data.recurso,
      endpoint,
      usuario: data.usuario,
      senha: data.senha ?? "",
      autor,
    });
    memCache.clear();

    // auditoria sem a senha (gravada pelo servidor, com IP)
    const { auditar } = await import("@/lib/auditoria.server");
    await auditar({
      userId: ctx.userId,
      acao: "atualizar_integracao",
      entidade: "integracao_rm",
      entidadeId: data.recurso,
      detalhes: {
        recurso: data.recurso,
        endpoint,
        usuario: data.usuario,
        senha_alterada: !!data.senha,
        ...(primeiroCadastro ? { primeiro_cadastro: true } : {}),
      },
    });
    return { ok: true };
  });

/** Consulta o RM com as credenciais gravadas. Compradores usa o primeiro empreendimento como exemplo. */
export const testarConexaoRm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ recurso: recursoRmSchema })))
  .handler(async ({ data, context }): Promise<TesteConexaoRm> => {
    await exigirAdmin(context as unknown as Contexto);
    const rm = await import("./rm.server");
    if (!rm.ehRecursoRm(data.recurso)) return { ok: false, msg: "Integração desconhecida." };
    try {
      const cred = await rm.credencialRm(data.recurso);
      if (!cred) return { ok: false, msg: "Cadastre o endpoint, o usuário e a senha desta integração antes de testar." };

      let url = cred.endpoint;
      if (data.recurso === "compradores") {
        const emp = await rm.credencialRm("empreendimentos");
        if (!emp) return { ok: false, msg: "Cadastre primeiro a integração de empreendimentos: o teste usa um deles como exemplo." };
        const primeiro = mapEmpreendimentos(extractRows(await rm.buscarNoRm(emp.endpoint, emp)))[0];
        if (!primeiro) return { ok: false, msg: "O RM não devolveu nenhum empreendimento para usar no teste." };
        url = rm.urlCompradores(cred.endpoint, primeiro.codigo);
      }

      const rows = extractRows(await rm.buscarNoRm(url, cred));
      void rm.registrarConsultaRm(data.recurso).catch(() => undefined);
      return {
        ok: true,
        msg: `Conexão OK — ${rows.length} registro(s) retornado(s).`,
        registros: rows.length,
        campos: rows[0] ? Object.keys(rows[0]).slice(0, 12) : [],
      };
    } catch (e) {
      return { ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido ao testar o TOTVS RM" };
    }
  });
