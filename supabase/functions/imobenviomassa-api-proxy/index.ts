// Edge function api-proxy
// Recebe { apiId, params?, body? } e executa server-side a API cadastrada
// em api_registry, aplicando autenticação configurada e substituindo
// placeholders {nome} no endpoint.
//
// Segurança (auditoria 2026-10-01, Fase 3):
// - Só Admin/Super Admin com cadastro ativo executam (JWT verificado + imobenviomassa.usuarios + Central de acessos).
// - Destino: apenas hosts cadastrados em api_registry.base_url (Super Admin) ou a origem do TOTVS RM
//   (Integrações TOTVS RM). Exige https://; http:// só para host de intranet (IP privado, `.local`
//   ou nome sem ponto, caso do RM interno). localhost/127.*/169.254.*/metadata/*.supabase.co nunca.
// - Secrets de API (auth_type bearer/header/basic de terceiros) DEVEM ser cadastrados no Supabase com o
//   prefixo GW_ (ex.: GW_TOTVS_TOKEN, GW_PARCEIRO_USER/GW_PARCEIRO_PASSWORD). Qualquer outro nome é
//   recusado — os secrets do runtime (SUPABASE_*, DB, JWT) nunca saem daqui.
// - CORS restrito a ALLOWED_ORIGINS (lista separada por vírgula). Sem a env, cai para "*" com aviso.
// - Respostas de erro não expõem URL de destino nem detalhes internos (ficam só no log do servidor).

import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase().replace(/\/$/, ""))
  .filter(Boolean);
let avisoCorsEmitido = false;

function corsHeaders(req: Request): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (ALLOWED_ORIGINS.length === 0) {
    if (!avisoCorsEmitido) {
      avisoCorsEmitido = true;
      console.warn(
        "[api-proxy] ALLOWED_ORIGINS não configurado: respondendo CORS com '*'. Configure o secret ALLOWED_ORIGINS (ex.: https://portal.calper.com.br,http://localhost:3000).",
      );
    }
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }
  const origin = (req.headers.get("Origin") ?? "").toLowerCase().replace(/\/$/, "");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  // Origem não permitida: sem Access-Control-Allow-Origin o navegador bloqueia a leitura.
  return { ...base, Vary: "Origin" };
}

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRA_HEADERS = 10;
const MAX_HEADER_VALUE_LEN = 500;
const MAX_PARAM_VALUE_LEN = 500;

class RequestError extends Error {
  constructor(message: string, public status = 400, public errorCode = "BAD_REQUEST") {
    super(message);
  }
}

interface ProxyRequest {
  apiId: string;
  params?: Record<string, string>;
  totvsParameters?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valores de placeholder entram no caminho da URL: nada de path traversal, separadores ou CR/LF
// (mesmo percent-encoded, o RM/IIS decodifica antes de rotear).
const PARAM_VALOR_PROIBIDO = /\.\.|[\/\\\r\n\0]|%2e|%2f|%5c|%0a|%0d/i;

function validarParams(params: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, raw] of Object.entries(params ?? {})) {
    if (!/^\w{1,64}$/.test(k)) throw new RequestError(`Nome de parâmetro inválido: ${k.slice(0, 40)}`);
    const v = raw == null ? "" : String(raw);
    if (v.length > MAX_PARAM_VALUE_LEN) throw new RequestError(`Parâmetro ${k} excede ${MAX_PARAM_VALUE_LEN} caracteres`);
    if (PARAM_VALOR_PROIBIDO.test(v)) throw new RequestError(`Parâmetro ${k} contém caracteres não permitidos`);
    out[k] = v;
  }
  return out;
}

function applyParams(endpoint: string, params: Record<string, string>) {
  let out = endpoint;
  for (const [k, v] of Object.entries(params)) {
    const safe = encodeURIComponent(v);
    out = out.replaceAll(`{${k}}`, safe).replaceAll(`:${k}`, safe);
  }
  return out;
}

function buildTotvsParametersQS(totvsParameters?: Record<string, string>) {
  if (!totvsParameters) return "";
  const pairs = Object.entries(totvsParameters)
    .filter(([, v]) => v != null && String(v).length > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
  if (!pairs) return "";
  // TOTVS RM RealizaConsulta exige o valor inteiro de 'parameters' percent-encoded
  // (incluindo o '=' interno). Sem isso, o servidor faz split por '&'/'='
  // e o SQL recebe 0 parâmetros nomeados → erro FE011.
  return `parameters=${encodeURIComponent(pairs)}`;
}

function buildQueryString(
  queryParams?: Record<string, string>,
  totvsParameters?: Record<string, string>,
) {
  const parts: string[] = [];
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v == null || v === "") continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  const totvsQs = buildTotvsParametersQS(totvsParameters);
  if (totvsQs) parts.push(totvsQs);
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// Allowlist de destino (B5/A10): o proxy só encaminha para hosts cadastrados e nunca para a rede
// interna do Supabase/cloud. http:// só para o RM interno (intranet).
// ---------------------------------------------------------------------------
function isIpPrivado(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function hostBloqueado(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "[::1]" || host.startsWith("::ffff:")) return true;
  if (/^127\./.test(host) || /^169\.254\./.test(host)) return true;
  if (host === "metadata.google.internal" || host === "metadata" || host.endsWith(".internal")) return true;
  if (host === "supabase.co" || host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return true;
  try {
    const own = new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname.toLowerCase();
    if (own && host === own) return true;
  } catch {
    /* sem SUPABASE_URL válida: ignora */
  }
  return false;
}

// Devolve a origem validada (sem path) ou lança RequestError. `rotulo` só aparece no log.
function validarDestino(base: string, rotulo: string): string {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    console.error(`[api-proxy] ${rotulo}: base_url inválida`);
    throw new RequestError("Destino da API inválido", 400, "BAD_TARGET");
  }
  const host = u.hostname.toLowerCase();
  if (!host || hostBloqueado(host)) {
    console.error(`[api-proxy] ${rotulo}: host bloqueado (${host})`);
    throw new RequestError("Destino da API não permitido", 400, "BAD_TARGET");
  }
  if (u.username || u.password) {
    throw new RequestError("Destino da API não pode conter credenciais na URL", 400, "BAD_TARGET");
  }
  if (u.protocol === "https:") return u.origin;
  if (u.protocol === "http:") {
    // http só na intranet: IP privado, sufixo .local ou nome de host sem ponto (ex.: servidor-do-rm:8051).
    const intranet = isIpPrivado(host) || host.endsWith(".local") || !host.includes(".");
    if (intranet) return u.origin;
    console.error(`[api-proxy] ${rotulo}: http:// só é aceito para host de intranet (${host})`);
    throw new RequestError("Destino da API precisa usar https://", 400, "BAD_TARGET");
  }
  throw new RequestError("Destino da API precisa usar https://", 400, "BAD_TARGET");
}

// ---------------------------------------------------------------------------
// Autorização / credenciais
// ---------------------------------------------------------------------------
// Cadastro do usuário no app (schema imobenviomassa): ativo, sem troca de senha pendente e numa imobiliária ativa
// (mesma regra de src/lib/authz.ts). Sem cadastro ou erro na consulta = sem acesso (fail closed).
type Cadastro = { imobiliaria_id: string; perfil: string };
async function cadastroLiberado(admin: ReturnType<typeof createClient>, userId: string): Promise<Cadastro | null> {
  const r = await admin
    .from("usuarios")
    .select("imobiliaria_id, perfil, ativo, trocar_senha, imobiliaria:imobiliarias(ativo)")
    .eq("id", userId)
    .maybeSingle();
  if (r.error || !r.data) return null;
  const m = r.data as { imobiliaria_id: string; perfil: string; ativo?: boolean; trocar_senha?: boolean; imobiliaria?: { ativo?: boolean } | null };
  if (m.ativo === false || m.trocar_senha === true || m.imobiliaria?.ativo === false) return null;
  return { imobiliaria_id: m.imobiliaria_id, perfil: m.perfil };
}

// Central de acessos do ikvj (public.pode_acessar_app), com o token do próprio usuário. Só um false explícito bloqueia.
async function liberadoNaCentral(supabaseUrl: string, chave: string, authHeader: string): Promise<boolean> {
  try {
    const c = createClient(supabaseUrl, chave, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await c.rpc("pode_acessar_app", { p_app: "imobenviomassa" });
    return error ? true : data !== false;
  } catch {
    return true;
  }
}

// Credenciais do TOTVS RM da imobiliária, lidas só com a service_role via imobenviomassa.rm_credenciais. A base
// (origem) vem do endpoint cadastrado para empreendimentos.
async function loadTotvsConfig(admin: ReturnType<typeof createClient>, imobiliariaId: string) {
  try {
    const { data } = await admin.rpc("rm_credenciais", { p_imobiliaria: imobiliariaId, p_recurso: "empreendimentos" });
    const c = (data as { endpoint: string; usuario: string; senha: string }[] | null)?.[0];
    if (!c) return null;
    let base_url: string | null = null;
    try {
      base_url = c.endpoint ? new URL(c.endpoint).origin : null;
    } catch {
      base_url = null;
    }
    return { base_url, username: c.usuario || null, password: c.senha || null, auth_type: "basic" };
  } catch {
    return null;
  }
}

// Allowlist: só secrets cadastrados com prefixo GW_ podem virar credencial de API. Os secrets do runtime
// (SUPABASE_*, DB_URL, JWT, service_role) ficam fora por construção.
const SECRET_PERMITIDO = /^GW_[A-Z0-9_]{1,80}$/;
function exigirSecretPermitido(nome: string) {
  if (!SECRET_PERMITIDO.test(nome)) {
    throw new Error(
      `Secret "${nome || "(vazio)"}" não permitido: secrets de API devem ser cadastrados com prefixo GW_ (ex.: GW_TOTVS_TOKEN)`,
    );
  }
}

async function buildAuthHeader(
  authType: string,
  secretRef: string | null,
  totvsCfg: Awaited<ReturnType<typeof loadTotvsConfig>>,
) {
  if (!authType || authType === "none") return null;

  if (authType === "basic") {
    const ref = (secretRef || "").trim();
    let user: string | null = null;
    let pass: string | null = null;
    if (!ref || /^totvs/i.test(ref)) {
      // TOTVS RM: credenciais cadastradas em Configurações → Integrações TOTVS RM
      user = totvsCfg?.username ?? null;
      pass = totvsCfg?.password ?? null;
      if (!user || !pass) {
        throw new Error(
          "Credenciais do TOTVS RM não cadastradas. Cadastre em Configurações → Integrações TOTVS RM.",
        );
      }
    } else {
      // outras APIs: secrets GW_<REF>_USER / GW_<REF>_PASSWORD
      exigirSecretPermitido(ref);
      user = Deno.env.get(`${ref}_USER`) ?? null;
      pass = Deno.env.get(`${ref}_PASSWORD`) ?? null;
      if (!user || !pass) throw new Error(`Secrets ${ref}_USER/${ref}_PASSWORD não configurados`);
    }
    const token = btoa(`${user}:${pass}`);
    return { name: "Authorization", value: `Basic ${token}` };
  }

  if (authType === "bearer") {
    const ref = (secretRef || "").trim();
    exigirSecretPermitido(ref);
    const token = Deno.env.get(ref);
    if (!token) throw new Error(`Secret ${ref} não configurado`);
    return { name: "Authorization", value: `Bearer ${token}` };
  }

  if (authType === "header") {
    const ref = (secretRef || "").trim();
    const [headerName, envName] = ref.split(":");
    if (!headerName || !envName || !/^[\w-]{1,64}$/.test(headerName)) {
      throw new Error(
        `auth_secret_ref inválido para 'header'. Use formato 'NomeHeader:GW_NOME_SECRET'`,
      );
    }
    exigirSecretPermitido(envName);
    const value = Deno.env.get(envName);
    if (!value) throw new Error(`Secret ${envName} não configurado`);
    return { name: headerName, value };
  }

  throw new Error(`auth_type desconhecido: ${authType}`);
}

// Cabeçalhos extras vindos do cliente: allowlist estrita. Credenciais e roteamento são resolvidos só
// aqui (buildAuthHeader); o cliente nunca manda Authorization/Host/Cookie/X-Forwarded-*.
const EXTRA_HEADER_PERMITIDO = /^(accept|content-type|x-request-id|x-totvs-[\w-]{1,40})$/;

function sanitizeExtraHeaders(extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const entries = Object.entries(extra ?? {});
  if (entries.length > MAX_EXTRA_HEADERS) {
    throw new RequestError(`No máximo ${MAX_EXTRA_HEADERS} cabeçalhos extras`);
  }
  for (const [k, v] of entries) {
    const name = k.trim().toLowerCase();
    if (!EXTRA_HEADER_PERMITIDO.test(name)) {
      throw new RequestError(`Cabeçalho extra não permitido: ${name.slice(0, 40)}`);
    }
    if (typeof v !== "string" || v.length > MAX_HEADER_VALUE_LEN || /[\r\n\0]/.test(v)) {
      throw new RequestError(`Valor inválido para o cabeçalho ${name}`);
    }
    out[name] = v;
  }
  return out;
}

// A URL é do RM se tiver a mesma origem do endpoint cadastrado em Integrações → TOTVS RM (nada de
// IP/porta fixos no código).
function isTotvsUrl(url: string | null | undefined, rmOrigin: string | null | undefined) {
  if (!url) return false;
  if (rmOrigin) {
    try {
      if (new URL(url).origin === rmOrigin) return true;
    } catch {
      /* URL inválida: cai no teste abaixo */
    }
  }
  return /totvs/i.test(url);
}

// Logs sem dados pessoais: só método, caminho (sem query string), status e duração. O corpo da
// resposta do RM traz CPF/telefone/e-mail de compradores e NUNCA vai para o log.
function urlSemQuery(url: string) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

// Lê o corpo até MAX_RESPONSE_BYTES; acima disso aborta a leitura (sem estourar memória da function).
async function lerCorpoLimitado(resp: Response): Promise<string> {
  const cl = Number(resp.headers.get("content-length") ?? "");
  if (Number.isFinite(cl) && cl > MAX_RESPONSE_BYTES) {
    await resp.body?.cancel().catch(() => {});
    throw new RequestError("Resposta da API destino excede 5 MB", 502, "RESPONSE_TOO_LARGE");
  }
  const reader = resp.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new RequestError("Resposta da API destino excede 5 MB", 502, "RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  // Detalhe fica só no log do servidor; o cliente recebe mensagem genérica + errorCode.
  const sessionExpiredResponse = (detalhe?: string) => {
    if (detalhe) console.warn("[api-proxy] sessão inválida:", detalhe);
    return jsonResponse({
      ok: false,
      status: 401,
      error: "Sessão expirada. Faça login novamente.",
      errorCode: "SESSION_EXPIRED",
      fallback: true,
    });
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, status: 405, error: "Method not allowed", errorCode: "METHOD_NOT_ALLOWED" }, 405);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";
    if (!authHeader || !token || token === ANON) {
      return sessionExpiredResponse("Authorization header ausente ou inválido");
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return sessionExpiredResponse(`getUser falhou: ${userErr?.message}`);
    }

    const payload = (await req.json().catch(() => null)) as ProxyRequest | null;
    if (!payload?.apiId || typeof payload.apiId !== "string" || !UUID_RE.test(payload.apiId)) {
      return jsonResponse({ ok: false, status: 400, error: "apiId (uuid) é obrigatório", errorCode: "BAD_REQUEST" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { db: { schema: "imobenviomassa" } });

    // Cadastro ativo numa imobiliária ativa e liberado na Central de acessos.
    const cadastro = await cadastroLiberado(admin, userData.user.id);
    if (!cadastro || !(await liberadoNaCentral(SUPABASE_URL, ANON, authHeader!))) {
      return jsonResponse(
        { ok: false, status: 403, error: "Seu acesso ao portal está desativado ou há troca de senha pendente", errorCode: "FORBIDDEN" },
        403,
      );
    }
    // O gateway é ferramenta administrativa: só Admin e Super Admin executam APIs por aqui.
    if (cadastro.perfil !== "admin" && cadastro.perfil !== "super_admin") {
      return jsonResponse(
        { ok: false, status: 403, error: "Apenas administradores executam APIs pelo gateway", errorCode: "FORBIDDEN" },
        403,
      );
    }

    const { data: api, error: apiErr } = await admin
      .from("api_registry")
      .select("*")
      .eq("id", payload.apiId)
      .eq("imobiliaria_id", cadastro.imobiliaria_id)
      .single();

    if (apiErr || !api) {
      if (apiErr) console.error("[api-proxy] api_registry:", apiErr.message);
      return jsonResponse({ ok: false, status: 404, error: "API não encontrada", errorCode: "API_NOT_FOUND" }, 404);
    }

    // Entrada do cliente validada antes de qualquer montagem de URL/cabeçalho.
    const params = validarParams(payload.params);
    const extraHeaders = sanitizeExtraHeaders(payload.extraHeaders);

    // Credenciais TOTVS RM da imobiliária (via rm_credenciais)
    const totvsCfg = await loadTotvsConfig(admin, cadastro.imobiliaria_id);

    // Se a API cadastrada usa TOTVS (basic + secret 'totvs'/vazio, ou base_url TOTVS),
    // usamos a origem do endpoint cadastrado em Integrações → TOTVS RM.
    const usesTotvsAuth =
      (api.auth_type ?? "none") === "basic" &&
      (!api.auth_secret_ref || /^totvs/i.test(String(api.auth_secret_ref).trim()));
    const preferTotvsBase =
      usesTotvsAuth || isTotvsUrl(api.base_url, totvsCfg?.base_url) || !api.base_url;

    const effectiveBase =
      (preferTotvsBase && totvsCfg?.base_url) ? totvsCfg.base_url : api.base_url;

    if (!effectiveBase) {
      return jsonResponse(
        { ok: false, status: 400, error: "API sem base_url cadastrada (nem em api_registry nem em Integrações → TOTVS RM)", errorCode: "BAD_TARGET" },
        400,
      );
    }

    // Allowlist de destino: só a origem validada entra na URL final.
    const destino = validarDestino(String(effectiveBase), `api=${api.id}`);

    const endpointResolved = applyParams(String(api.endpoint ?? ""), params);
    const epPrefix = endpointResolved.startsWith("/") ? "" : "/";
    const queryString = buildQueryString(payload.queryParams, payload.totvsParameters);
    const fullUrl = `${destino}${epPrefix}${endpointResolved}${queryString}`;
    try {
      if (new URL(fullUrl).origin !== destino) throw new Error("origem divergente");
    } catch {
      console.error(`[api-proxy] endpoint cadastrado altera a origem (api=${api.id})`);
      return jsonResponse({ ok: false, status: 400, error: "Endpoint cadastrado inválido", errorCode: "BAD_TARGET" }, 400);
    }

    const method = (api.method || "GET").toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD" && payload.body != null;

    const headers: Record<string, string> = {
      accept: "*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...extraHeaders,
    };
    if (hasBody && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    try {
      // Se a API é TOTVS mas está cadastrada como 'none', força basic com credenciais salvas
      const effectiveAuthType =
        (api.auth_type ?? "none") === "none" && isTotvsUrl(destino, totvsCfg?.base_url) && totvsCfg?.username
          ? "basic"
          : (api.auth_type ?? "none");
      const auth = await buildAuthHeader(effectiveAuthType, api.auth_secret_ref, totvsCfg);
      if (auth) headers[auth.name] = auth.value;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[api-proxy] autenticação (api=${api.id}):`, msg);
      return jsonResponse({
        ok: false,
        status: 500,
        error: "Credenciais da API não configuradas. Verifique o cadastro no gateway.",
        errorCode: "AUTH_CONFIG",
        fallback: true,
      });
    }

    console.log(`[api-proxy] ${method} ${urlSemQuery(fullUrl)} (api=${api.id} auth=${api.auth_type})`);

    const start = Date.now();
    let upstream: Response;
    try {
      upstream = await fetch(fullUrl, {
        method,
        headers,
        body: hasBody ? JSON.stringify(payload.body) : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        redirect: "manual",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const aborted = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      console.error(`[api-proxy] fetch error (timeout=${aborted}) ${urlSemQuery(fullUrl)}:`, msg);
      return jsonResponse({
        ok: false,
        status: aborted ? 504 : 502,
        error: aborted
          ? `A API destino não respondeu em ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s. Tente novamente ou escolha um escopo menor.`
          : "Falha ao conectar na API destino",
        errorCode: aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE",
        fallback: true,
      });
    }

    const elapsedMs = Date.now() - start;
    let text: string;
    try {
      text = await lerCorpoLimitado(upstream);
    } catch (e) {
      if (e instanceof RequestError) {
        console.error(`[api-proxy] ${e.errorCode} ${urlSemQuery(fullUrl)}`);
        return jsonResponse({ ok: false, status: e.status, error: e.message, errorCode: e.errorCode, fallback: true });
      }
      throw e;
    }
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // mantém texto
    }

    console.log(
      `[api-proxy] upstream ${upstream.status} ${upstream.ok ? "OK" : upstream.statusText} ${elapsedMs}ms ${text.length} bytes`,
    );

    return jsonResponse({
      ok: upstream.ok,
      status: upstream.status,
      statusText: upstream.statusText,
      elapsedMs,
      url: upstream.ok ? fullUrl : undefined,
      data,
      rawBody: upstream.ok ? undefined : text,
    });
  } catch (e) {
    if (e instanceof RequestError) {
      console.warn(`[api-proxy] ${e.errorCode}:`, e.message);
      return jsonResponse({ ok: false, status: e.status, error: e.message, errorCode: e.errorCode }, e.status);
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api-proxy] erro:", msg);
    return jsonResponse({
      ok: false,
      status: 500,
      error: "Erro interno no gateway",
      errorCode: "INTERNAL",
      fallback: true,
    });
  }
});
