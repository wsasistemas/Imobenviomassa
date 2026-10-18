// totvs-soap-proxy: gateway SOAP genérico, reutilizável.
// Recebe { apiName | apiId, params, debug? } -> busca registro em api_registry +
// soap_envelope_templates, monta envelope, chama TOTVS, parseia XML e devolve JSON.
//
// Segurança (auditoria 2026-10-01, Fase 3):
// - Só Admin/Super Admin com cadastro ativo executam (JWT verificado + imobenviomassa.usuarios + Central de acessos).
// - Credenciais do RM vivem só no escopo da requisição (nunca em variável de módulo).
// - Resposta: só `data` (+ `error`/`fault` curtos em erro) com código HTTP real. O XML completo (`raw`)
//   só volta com `debug: true` E chamador super_admin.
// - XML parseado sem expansão de entidades; corpo do RM limitado a 5 MB; timeout de 30 s.
// - gateway_call_log guarda apenas metadados e faultcode/faultstring (≤ 300 chars, senha mascarada).
// - CORS restrito a ALLOWED_ORIGINS (lista separada por vírgula). Sem a env, cai para "*" com aviso.
import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@^5";

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
        "[totvs-soap-proxy] ALLOWED_ORIGINS não configurado: respondendo CORS com '*'. Configure o secret ALLOWED_ORIGINS (ex.: https://portal.calper.com.br,http://localhost:3000).",
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
// Limites e tipos
// ---------------------------------------------------------------------------
const UPSTREAM_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_ERROR_LEN = 300;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const TOTVS_SOAP_8051 = Deno.env.get("TOTVS_SOAP_8051") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_NAME_RE = /^[\w.-]{1,100}$/;

// Credenciais do RM: objeto local da requisição (lidas via public.rm_credenciais, só service_role).
interface RmCred {
  user: string;
  password: string;
}

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

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

const SERVICE_ENDPOINTS: Record<string, string> = {
  consultaSQL: "/wsConsultaSQL/IwsConsultaSQL",
  dataServer: "/wsDataServer/MIwsDataServer",
  process: "/wsProcess/MIwsProcess",
};

function resolveReservedTokens(s: string, cred: RmCred): string {
  return String(s ?? "")
    .replace(/\{\{\s*TOTVS_USER\s*\}\}/g, cred.user)
    .replace(/\{\{\s*TOTVS_PASSWORD\s*\}\}/g, cred.password);
}

// A senha do RM nunca vai para log/resposta — nem na forma crua, nem XML-escapada.
function mascararSenha(texto: string, cred: RmCred | null): string {
  if (!cred?.password) return texto;
  let out = texto.split(cred.password).join("***");
  const escapada = escapeXml(cred.password);
  if (escapada !== cred.password) out = out.split(escapada).join("***");
  return out;
}

function escapeXml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const RAW_XML_KEYS = new Set(["xmlPayload", "xmlParameters"]);

function renderTemplate(
  template: string,
  params: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = params[key];
    if (RAW_XML_KEYS.has(key)) {
      // XML cru vindo do chamador: entra como está, mas NUNCA com as credenciais do RM resolvidas
      // ({{TOTVS_PASSWORD}} num parâmetro do chamador voltaria no corpo/resposta do RM).
      return String(v ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>");
    }
    return escapeXml(v);
  });
}

function getByPath(obj: unknown, path: string | null | undefined): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// Lê o corpo até MAX_RESPONSE_BYTES; acima disso aborta a leitura.
async function lerCorpoLimitado(resp: Response): Promise<string> {
  const cl = Number(resp.headers.get("content-length") ?? "");
  if (Number.isFinite(cl) && cl > MAX_RESPONSE_BYTES) {
    await resp.body?.cancel().catch(() => {});
    throw new HttpError("Resposta do TOTVS excede 5 MB", 502);
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
      throw new HttpError("Resposta do TOTVS excede 5 MB", 502);
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

// Só faultcode/faultstring (ou a mensagem curta de System.Exception) saem do XML do RM — nunca um
// trecho arbitrário do corpo (pode conter dados pessoais).
function extrairFault(rawText: string): { code: string | null; str: string | null } {
  const code = rawText.match(/<\s*(?:\w+:)?faultcode\s*>([^<]{0,120})</i)?.[1]?.trim() ?? null;
  const str = rawText.match(/<\s*(?:\w+:)?faultstring[^>]*>([^<]{0,300})</i)?.[1]?.trim() ?? null;
  if (code || str) return { code, str };
  const exc = rawText.match(/System\.Exception[^<]{0,250}/i)?.[0]?.trim() ?? null;
  return { code: exc ? "System.Exception" : null, str: exc };
}

function curto(texto: string | null | undefined, cred: RmCred | null): string | null {
  if (!texto) return null;
  return mascararSenha(texto, cred).slice(0, MAX_ERROR_LEN);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const started = Date.now();
  let userId: string | null = null;
  let cred: RmCred | null = null;

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: auth } },
    });

    try {
      const { data: u } = await supa.auth.getUser(auth.replace(/^Bearer\s+/, ""));
      userId = u?.user?.id ?? null;
    } catch {
      userId = null;
    }

    const body = (await req.json().catch(() => ({}))) as {
      apiId?: unknown;
      apiName?: unknown;
      params?: unknown;
      debug?: unknown;
    };

    const adm = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "imobenviomassa" } });

    // Autenticação obrigatória (além do verify_jwt do Supabase) e perfil administrativo:
    // esta função executa SOAP no RM com as credenciais da integração da imobiliária.
    if (!userId) throw new HttpError("Sessão inválida. Entre novamente.", 401);

    const cadastro = await cadastroLiberado(adm, userId);
    if (!cadastro || !(await liberadoNaCentral(SUPABASE_URL, SUPABASE_ANON_KEY, auth))) {
      throw new HttpError("Seu acesso ao portal está desativado ou há troca de senha pendente", 403);
    }
    const isGatewayAdmin = cadastro.perfil === "admin" || cadastro.perfil === "super_admin";
    const isSuperAdmin = cadastro.perfil === "super_admin";
    if (!isGatewayAdmin) throw new HttpError("Apenas administradores executam APIs pelo gateway", 403);

    // Validação da entrada do chamador.
    const apiId = typeof body.apiId === "string" && body.apiId ? body.apiId : null;
    const apiName = typeof body.apiName === "string" && body.apiName ? body.apiName : null;
    if (!apiId && !apiName) throw new HttpError("apiId ou apiName é obrigatório", 400);
    if (apiId && !UUID_RE.test(apiId)) throw new HttpError("apiId inválido (esperado uuid)", 400);
    if (apiName && !API_NAME_RE.test(apiName)) throw new HttpError("apiName inválido", 400);
    const params: Record<string, unknown> =
      body.params && typeof body.params === "object" && !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : {};
    const debug = body.debug === true && isSuperAdmin;

    const { data: credRows, error: credErr } = await adm.rpc("rm_credenciais", {
      p_imobiliaria: cadastro.imobiliaria_id,
      p_recurso: "empreendimentos",
    });
    const c = (credRows as { endpoint: string; usuario: string; senha: string }[] | null)?.[0];
    if (credErr || !c?.usuario || !c?.senha) {
      throw new HttpError(
        "Credenciais do TOTVS RM não cadastradas. Cadastre em Configurações → Integrações TOTVS RM.",
        500,
      );
    }
    cred = { user: c.usuario, password: c.senha };
    // As credenciais do RM só vão para o próprio RM: a origem vem do endpoint cadastrado em
    // Integrações TOTVS RM, nunca do base_url/endpoint da API registrada no gateway.
    let rmOrigin = "";
    try {
      rmOrigin = new URL(c.endpoint).origin;
    } catch {
      rmOrigin = "";
    }
    if (!rmOrigin && TOTVS_SOAP_8051) {
      try {
        rmOrigin = new URL(TOTVS_SOAP_8051).origin;
      } catch {
        rmOrigin = "";
      }
    }
    if (!rmOrigin) throw new HttpError("Endpoint do TOTVS RM não cadastrado em Integrações TOTVS RM.", 500);

    let q = adm.from("api_registry").select("*").eq("imobiliaria_id", cadastro.imobiliaria_id);
    if (apiId) q = q.eq("id", apiId);
    else q = q.eq("name", apiName!);

    const { data: api, error: errApi } = await q.maybeSingle();
    if (errApi) {
      console.error("[totvs-soap-proxy] api_registry:", errApi.message);
      throw new HttpError("Falha ao consultar o cadastro da API", 500);
    }
    if (!api) throw new HttpError("API não encontrada no api_registry", 404);
    if (api.source !== "soap") throw new HttpError("API cadastrada não é do tipo SOAP", 400);

    const service = api.soap_service as string | null;
    const action = api.soap_action as string | null;
    let envelope = api.soap_envelope_template as string | null;
    let responsePath = api.soap_response_path as string | null;

    if (!envelope) {
      const { data: tpl } = await adm
        .from("soap_envelope_templates")
        .select("*")
        .eq("service", service ?? "")
        .eq("action", action ?? "")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tpl) {
        envelope = tpl.envelope_xml as string;
        responsePath = responsePath ?? (tpl.response_path as string | null);
      }
    }

    if (!service || !action || !envelope) {
      throw new HttpError("Configuração SOAP incompleta (service/action/envelope)", 500);
    }

    const normalizedXmlPayload =
      params.xmlPayload ?? params.xmlParameters ?? params.strXmlParams ?? null;
    const fullParams: Record<string, unknown> = {
      ...params,
      xmlPayload: normalizedXmlPayload,
      xmlParameters: normalizedXmlPayload,
      strXmlParams: normalizedXmlPayload,
    };
    // Credenciais só são resolvidas no template cadastrado (super_admin), antes dos parâmetros.
    const xml = renderTemplate(resolveReservedTokens(envelope, cred), fullParams);

    // Do cadastro só se aproveita o caminho; o host é sempre o do RM.
    const endpointRaw = (api.endpoint as string | null) || SERVICE_ENDPOINTS[service] || "";
    let endpointPath = endpointRaw;
    if (/^https?:\/\//i.test(endpointRaw)) {
      try {
        const u = new URL(endpointRaw);
        endpointPath = u.pathname + u.search;
      } catch {
        endpointPath = "";
      }
    }
    if (!endpointPath.startsWith("/")) endpointPath = "/" + endpointPath;
    const url = `${rmOrigin}${endpointPath}`;

    const basic = btoa(`${cred.user}:${cred.password}`);

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: action,
          Authorization: `Basic ${basic}`,
        },
        body: xml,
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      console.error(`[totvs-soap-proxy] fetch ${url} falhou (timeout=${timeout}):`, e instanceof Error ? e.message : String(e));
      throw new HttpError(
        timeout
          ? `O TOTVS não respondeu em ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s. Tente novamente ou reduza o escopo.`
          : "Falha ao conectar no TOTVS RM",
        timeout ? 504 : 502,
      );
    }

    const rawText = await lerCorpoLimitado(resp);
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      parseTagValue: true,
      processEntities: false,
    });
    let parsed: unknown = null;
    try {
      parsed = parser.parse(rawText);
    } catch {
      parsed = null;
    }

    const respEmpty = !rawText || rawText.trim() === "";
    const payload = getByPath(parsed, responsePath ?? null);
    const responsePathMissing =
      !respEmpty && responsePath != null && payload === undefined;
    const fault = extrairFault(rawText);
    const isFault =
      !resp.ok ||
      respEmpty ||
      responsePathMissing ||
      /<\s*(?:\w+:)?Fault\b/i.test(rawText) ||
      fault.code != null;

    let errorMessage: string | null = null;
    if (respEmpty) {
      errorMessage = `TOTVS retornou resposta vazia (HTTP ${resp.status}). Verifique endpoint/payload.`;
    } else if (fault.code || fault.str) {
      errorMessage = [fault.code, fault.str].filter(Boolean).join(": ");
    } else if (responsePathMissing) {
      errorMessage = `Resposta TOTVS não contém ${responsePath}.`;
    } else if (!resp.ok) {
      errorMessage = `TOTVS respondeu HTTP ${resp.status}${resp.statusText ? ` ${resp.statusText}` : ""}.`;
    } else if (isFault) {
      errorMessage = "TOTVS retornou SOAP Fault.";
    }
    const errorCurto = curto(errorMessage, cred);

    const duration = Date.now() - started;

    // Log só com metadados: a resposta do RM traz dados pessoais de compradores e o envelope traz
    // os parâmetros da consulta — nenhum dos dois é persistido (auditoria de segurança 2026-10-01).
    try {
      await adm.from("gateway_call_log").insert({
        imobiliaria_id: cadastro.imobiliaria_id,
        user_id: userId,
        api_id: api.id,
        api_name: api.name,
        kind: "soap",
        request_payload: {
          param_keys: Object.keys(params),
          action,
          service,
          url,
          envelope_bytes: xml.length,
        },
        response_payload: {
          bytes: rawText.length,
          fault: isFault,
          // Só faultcode/faultstring (sem trecho do corpo), ≤ 300 chars, senha mascarada.
          preview_erro: isFault ? curto([fault.code, fault.str].filter(Boolean).join(": ") || null, cred) : null,
        },
        http_status: resp.status,
        duration_ms: duration,
        status: isFault ? "error" : "success",
        error_message: errorCurto,
      });
    } catch (e) {
      console.error("gateway_call_log insert failed", e instanceof Error ? e.message : String(e));
    }

    if (isFault) {
      const httpStatus = [400, 401, 403, 404].includes(resp.status) ? resp.status : 502;
      return json(
        {
          ok: false,
          status: resp.status,
          fault: true,
          error: errorCurto ?? "TOTVS retornou erro.",
          duration_ms: duration,
          ...(debug ? { raw: mascararSenha(rawText, cred) } : {}),
        },
        httpStatus,
      );
    }

    return json(
      {
        ok: true,
        status: resp.status,
        data: payload,
        duration_ms: duration,
        ...(debug ? { raw: mascararSenha(rawText, cred) } : {}),
      },
      200,
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[totvs-soap-proxy] ${status}:`, mascararSenha(message, cred));
    return json(
      {
        ok: false,
        fault: true,
        error: status === 500 && !(err instanceof HttpError)
          ? "Erro interno no gateway SOAP"
          : curto(message, cred),
        duration_ms: Date.now() - started,
      },
      status,
    );
  }
});
