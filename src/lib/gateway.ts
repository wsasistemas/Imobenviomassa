// ============================================================
// Gateway client — chama as edge functions api-proxy / totvs-soap-proxy
// deste próprio Supabase para acessar TOTVS RM (SQL + SOAP) sem
// depender de allowlist de porta no firewall.
// ============================================================

import { supabase } from "@/integrations/supabase/client";

// As edge functions devolvem o código HTTP real (400/401/403/404/502…). Nesses casos
// supabase.functions.invoke entrega um FunctionsHttpError cujo `context` é a Response:
// lemos o JSON de lá para não perder `error`/`errorCode`/`fault` enviados pelo servidor.
async function corpoDoErro<T extends { ok: boolean; status?: number; error?: string | null }>(
  error: unknown,
  fallback: T,
): Promise<T> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as Partial<T> | null;
      if (body && typeof body === "object") {
        return { ...fallback, ...body, ok: false, status: body.status ?? ctx.status } as T;
      }
    } catch {
      /* corpo não é JSON: usa o fallback */
    }
    return { ...fallback, status: ctx.status } as T;
  }
  return fallback;
}

// ------------------------------------------------------------
// api-proxy — REST/SQL (TOTVS RealizaConsulta, APIs internas, etc.)
// ------------------------------------------------------------
export interface GwProxyOptions {
  params?: Record<string, string>;
  totvsParameters?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

export interface GwProxyResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText?: string;
  elapsedMs?: number;
  /** URL efetiva (sem credenciais); só vem em sucesso. */
  url?: string;
  data?: T;
  rawBody?: string;
  error?: string;
  errorCode?: string;
  fallback?: boolean;
}

export async function gwProxy<T = unknown>(
  apiId: string,
  options: GwProxyOptions = {},
): Promise<GwProxyResponse<T>> {
  const { data, error } = await supabase.functions.invoke("imobenviomassa-api-proxy", {
    body: { apiId, ...options },
  });
  if (error) {
    return corpoDoErro<GwProxyResponse<T>>(error, { ok: false, status: 0, error: error.message });
  }
  return data as GwProxyResponse<T>;
}

// ------------------------------------------------------------
// totvs-soap-proxy — SOAP (wsConsultaSQL / wsDataServer / wsProcess)
// ------------------------------------------------------------
export interface GwSoapResponse<T = unknown> {
  ok: boolean;
  /** HTTP do TOTVS RM (a resposta da function usa o código real: 400/401/403/404/502…). */
  status?: number;
  data?: T;
  /** Não é mais devolvido pelo servidor; mantido opcional por compatibilidade. */
  parsed?: unknown;
  /** XML completo (senha mascarada): só com `{ debug: true }` e chamador super_admin. */
  raw?: string;
  /** Mensagem curta (≤ 300 chars) em erro. */
  error?: string | null;
  /** true quando o RM devolveu SOAP Fault/erro ou o gateway falhou. */
  fault?: boolean;
  duration_ms?: number;
}

export interface GwSoapOptions {
  /** Pede o XML bruto (`raw`); só é atendido para super_admin. */
  debug?: boolean;
}

export async function gwSoap<T = unknown>(
  apiName: string,
  params: Record<string, unknown> = {},
  options: GwSoapOptions = {},
): Promise<GwSoapResponse<T>> {
  const { data, error } = await supabase.functions.invoke("imobenviomassa-totvs-soap-proxy", {
    body: { apiName, params, ...options },
  });
  if (error) return corpoDoErro<GwSoapResponse<T>>(error, { ok: false, error: error.message });
  return data as GwSoapResponse<T>;
}

export async function gwSoapById<T = unknown>(
  apiId: string,
  params: Record<string, unknown> = {},
  options: GwSoapOptions = {},
): Promise<GwSoapResponse<T>> {
  const { data, error } = await supabase.functions.invoke("imobenviomassa-totvs-soap-proxy", {
    body: { apiId, params, ...options },
  });
  if (error) return corpoDoErro<GwSoapResponse<T>>(error, { ok: false, error: error.message });
  return data as GwSoapResponse<T>;
}

// ===================================================
// Registro de APIs (api_registry) — só leitura aqui.
// Cadastrar/remover é feito pelas server functions registrarApiGateway /
// removerApiGateway (src/lib/gateway.functions.ts): Super Admin, validado e auditado.
// ===================================================
export async function getApisRegistradas() {
  const { data, error } = await (supabase as any)
    .from("api_registry")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[gateway] api_registry:", error.code ?? error.message);
    throw new Error("Não foi possível carregar as APIs cadastradas.");
  }
  return data ?? [];
}
