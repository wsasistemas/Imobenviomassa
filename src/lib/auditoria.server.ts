// Auditoria gravada SÓ pelo servidor (service_role), com IP e user agent da requisição.
// Server-only (*.server.ts): importar dentro do handler da server function com `await import`.
//
// O navegador não insere mais em wa_auditoria (INSERT revogado de `authenticated` na migração
// 20261001120000): toda trilha nasce aqui, então ninguém forja ação, entidade ou nome de usuário.

import { getRequest } from "@tanstack/react-start/server";

export type EntradaAuditoria = {
  userId: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown> | null;
  /** Nome a exibir; se omitido, lê de profiles (full_name/email). */
  usuarioNome?: string | null;
};

/** IP do cliente atrás da Vercel (x-real-ip / primeiro x-forwarded-for) ou "desconhecido". */
export function ipDaRequisicao(): string {
  try {
    const req = getRequest();
    const real = req?.headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
    const fwd = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd.slice(0, 64);
  } catch {
    /* fora de uma requisição (ex.: job) */
  }
  return "desconhecido";
}

export function userAgentDaRequisicao(): string | null {
  try {
    const ua = getRequest()?.headers.get("user-agent");
    return ua ? ua.slice(0, 300) : null;
  } catch {
    return null;
  }
}

/**
 * Chaves que nunca vão para `detalhes` (mesmo que alguém passe por engano), em qualquer nível do
 * objeto: segredos e dados pessoais de compradores. `email` é permitido só para identificar o
 * usuário do portal (login, cadastro) — nunca passe e-mail de comprador aqui.
 */
const CHAVES_PROIBIDAS =
  /senha|password|secret|token|chave|private|rsa|authorization|cpf|cnpj|documento|telefone|celular|whatsapp|phone|rg\b/i;
const PROFUNDIDADE_MAX = 4;

function limparValor(v: unknown, profundidade: number): unknown {
  if (typeof v === "string") return v.length > 500 ? v.slice(0, 500) + "…" : v;
  if (Array.isArray(v)) {
    if (profundidade >= PROFUNDIDADE_MAX) return `[${v.length} itens]`;
    return v.slice(0, 50).map((x) => limparValor(x, profundidade + 1));
  }
  if (v && typeof v === "object") {
    if (profundidade >= PROFUNDIDADE_MAX) return "[objeto]";
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (CHAVES_PROIBIDAS.test(k)) continue;
      out[k] = limparValor(x, profundidade + 1);
    }
    return out;
  }
  return v;
}

function limparDetalhes(detalhes?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!detalhes) return null;
  return limparValor(detalhes, 0) as Record<string, unknown>;
}

export async function auditar(entrada: EntradaAuditoria): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let usuarioNome = entrada.usuarioNome ?? null;
  if (!usuarioNome && entrada.userId) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", entrada.userId)
      .maybeSingle();
    usuarioNome = data?.full_name ?? data?.email ?? null;
  }

  const linha = {
    usuario_id: entrada.userId,
    usuario_nome: usuarioNome,
    acao: entrada.acao,
    entidade: entrada.entidade,
    entidade_id: entrada.entidadeId ?? null,
    detalhes: limparDetalhes(entrada.detalhes) as never,
    ip: ipDaRequisicao(),
    user_agent: userAgentDaRequisicao(),
  };

  let { error } = await supabaseAdmin.from("wa_auditoria").insert(linha as never);
  // Antes da migração 20261001120000 a coluna user_agent não existe.
  if (error && /user_agent/.test(error.message)) {
    const { user_agent: _ua, ...semUa } = linha;
    ({ error } = await supabaseAdmin.from("wa_auditoria").insert(semUa as never));
  }
  if (error) console.error("[auditoria] falha ao gravar:", error.message);
}
