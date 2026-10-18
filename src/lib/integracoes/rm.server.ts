// Acesso ao TOTVS RM — só no servidor (Vercel), nunca no navegador. Mesmo modelo do Portal DP:
//
//   · usuário e senha do RM são comuns; cada integração tem o seu endpoint (URL completa);
//   · as credenciais ficam no schema privado envio_privado, fora da Data API. Só a chave service_role
//     lê (public.rm_credenciais). A senha nunca volta para a tela nem aparece em log;
//   · a SENHA fica criptografada no Supabase Vault (secret rm_senha) quando a migração
//     20261001170000_vault_segredos.sql está aplicada e o Vault ativo (auditoria, Fase 4 / M3). Tudo isso
//     acontece DENTRO das funções SQL (rm_credenciais, rm_credenciais_salvar, rm_status), que mantêm a
//     mesma assinatura: este módulo e as Edge Functions não mudam. Sem o Vault a senha continua na coluna
//     envio_privado.integracao_rm.senha (fallback) e tudo funciona como antes;
//   · a chamada ao RM é direta (fetch com Basic Auth), sem Edge Function no meio.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { erroGenerico, logErro } from "@/lib/erros.server";

export const RECURSOS_RM = ["empreendimentos", "compradores"] as const;
export type RecursoRm = (typeof RECURSOS_RM)[number];

export const ehRecursoRm = (v: string): v is RecursoRm => (RECURSOS_RM as readonly string[]).includes(v);

const TEMPO_LIMITE_MS = 25_000;

export interface CredencialRm {
  endpoint: string;
  usuario: string;
  senha: string;
}

export interface StatusRm {
  recurso: RecursoRm;
  configurado: boolean;
  endpoint: string;
  usuario: string;
  atualizadoEm: string | null;
  atualizadoPor: string;
  ultimaConsulta: string | null;
}

/** Erro de banco que indica que a migração 20260929120000_rm_credenciais_privado.sql ainda não rodou. */
const semMigracao = (msg: string) => /does not exist|schema cache|could not find the function/i.test(msg);

export async function credencialRm(recurso: RecursoRm): Promise<CredencialRm | null> {
  const { data, error } = await supabaseAdmin.rpc("rm_credenciais", { p_recurso: recurso });
  if (error) {
    // "Migração não aplicada" é uma mensagem fixa (sem dado do banco); o resto fica só no log.
    if (semMigracao(error.message)) {
      throw new Error(
        "Integração TOTVS RM ainda não disponível no banco. Rode a migração 20260929120000_rm_credenciais_privado.sql no Supabase.",
      );
    }
    throw erroGenerico("rm.credencialRm", error, "Não foi possível ler as credenciais do TOTVS RM.");
  }
  const c = data?.[0];
  if (!c?.endpoint || !c.usuario || !c.senha) return null;
  return c;
}

export async function statusRm(): Promise<StatusRm[] | null> {
  const { data, error } = await supabaseAdmin.rpc("rm_status");
  if (error) {
    if (semMigracao(error.message)) return null;
    throw erroGenerico("rm.statusRm", error, "Não foi possível ler as integrações do TOTVS RM.");
  }
  return RECURSOS_RM.map((recurso) => {
    const l = (data ?? []).find((x) => x.recurso === recurso);
    return {
      recurso,
      configurado: l?.configurado === true,
      endpoint: l?.endpoint ?? "",
      usuario: l?.usuario ?? "",
      atualizadoEm: l?.atualizado_em ?? null,
      atualizadoPor: l?.atualizado_por ?? "",
      ultimaConsulta: l?.ultima_consulta ?? null,
    };
  });
}

export async function salvarCredencialRm(input: {
  recurso: RecursoRm;
  endpoint: string;
  usuario: string;
  senha: string;
  autor: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("rm_credenciais_salvar", {
    p_recurso: input.recurso,
    p_endpoint: input.endpoint,
    p_usuario: input.usuario,
    p_senha: input.senha,
    p_autor: input.autor,
  });
  if (error) throw erroGenerico("rm.salvarCredencialRm", error, "Não foi possível gravar as credenciais.");
}

export async function registrarConsultaRm(recurso: RecursoRm): Promise<void> {
  await supabaseAdmin.rpc("rm_consulta_registrar", { p_recurso: recurso });
}

/** GET no RM (B6: com tempo limite). Erros de rede/credencial viram mensagem do que fazer, sem expor a senha nem a URL. */
export async function buscarNoRm(url: string, cred: Pick<CredencialRm, "usuario" | "senha">): Promise<unknown> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        authorization: "Basic " + Buffer.from(`${cred.usuario}:${cred.senha}`).toString("base64"),
        accept: "application/json",
      },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (e) {
    const tempoEsgotado = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    logErro("rm.buscarNoRm", e, { url });
    throw new Error(
      tempoEsgotado
        ? "O TOTVS RM não respondeu a tempo. Tente de novo; se persistir, confira se o servidor do RM aceita conexões da internet."
        : "Não foi possível falar com o TOTVS RM. Confira o endpoint cadastrado e se o servidor aceita conexões da internet.",
    );
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("O TOTVS RM recusou o usuário ou a senha cadastrados (HTTP " + resp.status + ").");
  }
  if (resp.status === 404) throw new Error("O TOTVS RM não encontrou o endpoint cadastrado (HTTP 404).");
  if (!resp.ok) throw new Error("O TOTVS RM respondeu com erro (HTTP " + resp.status + ").");
  const cru = await resp.text();
  try {
    return JSON.parse(cru);
  } catch {
    throw new Error("A resposta do TOTVS RM não é JSON. Confira o endpoint cadastrado.");
  }
}

/** Endpoint de compradores com o código do empreendimento em ?parameters=CODCOLIGADA=… */
export function urlCompradores(endpoint: string, codcoligada: string): string {
  const codigo = encodeURIComponent(codcoligada);
  const re = /([?&]parameters=CODCOLIGADA=)[^&]*/i;
  if (re.test(endpoint)) return endpoint.replace(re, `$1${codigo}`);
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}parameters=CODCOLIGADA=${codigo}`;
}
