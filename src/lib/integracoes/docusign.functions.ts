import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ModeloDocusign } from "@/stores/wizard-store";

const DEMO_BASE = "https://demo.docusign.net/restapi/v2.1";
const DEMO_AUTH = "https://account-d.docusign.com";
const PROD_BASE = "https://na1.docusign.net/restapi/v2.1";
const PROD_AUTH = "https://account.docusign.com";

type DsCtx = { supabase: any; userId: string };

// ---------- Erros (auditoria de segurança, Fase 3 / N10) ----------
// O navegador recebe mensagem genérica; o detalhe (PostgREST, corpo do DocuSign, URL) vai só para o
// log do servidor via src/lib/erros.server.ts — carregado com import dinâmico porque *.functions.ts
// também vai para o bundle do navegador (importProtection do TanStack Start).
async function erros() {
  return import("@/lib/erros.server");
}
async function erroGenerico(origem: string, erro: unknown, mensagem: string): Promise<Error> {
  return (await erros()).erroGenerico(origem, erro, mensagem);
}

/** Erro HTTP da API do DocuSign: mensagem já resumida (só código/status, nunca o corpo da resposta). */
class ErroDocusign extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDocusign";
  }
}

// B6: todo fetch ao DocuSign tem tempo limite (AbortSignal.timeout).
const TIMEOUT_DOCUSIGN_MS = 30_000;
const TIMEOUT_PDF_DOCUSIGN_MS = 60_000;
const MSG_TIMEOUT_DOCUSIGN = "Tempo esgotado ao falar com o DocuSign.";
const MSG_REDE_DOCUSIGN = "Não foi possível conectar ao DocuSign.";
const ehTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

// ---------- Validação de entrada (auditoria de segurança, Fase 2 / N4) ----------
// Mesmo padrão de src/lib/campanhas.functions.ts: o input chega como `unknown`, passa pelo zod e só
// os campos do schema seguem para o handler (z.object faz strip dos demais por padrão).

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

// IDs de template/modelo do DocuSign são GUIDs; aceita só [A-Za-z0-9_-].
const templateIdSchema = z
  .string({ required_error: "Template não informado." })
  .trim()
  .min(1, "Template não informado.")
  .max(100, "Identificador de template muito longo.")
  .regex(/^[\w-]+$/, "Identificador de template inválido.");

// base_url / auth_url só podem apontar para o DocuSign (https + domínio docusign.com/docusign.net).
const HOSTS_DOCUSIGN_EXATOS = new Set(["account.docusign.com", "account-d.docusign.com"]);
function hostDocusignPermitido(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTS_DOCUSIGN_EXATOS.has(h) || h.endsWith(".docusign.net") || h.endsWith(".docusign.com");
}
const urlDocusignOpcional = z
  .string()
  .trim()
  .max(300, "URL muito longa.")
  .optional()
  .transform((v) => v || undefined)
  .superRefine((v, ctx) => {
    if (!v) return;
    let u: URL;
    try {
      u = new URL(v);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL do DocuSign inválida." });
      return;
    }
    if (u.protocol !== "https:" || !hostDocusignPermitido(u.hostname)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A URL deve começar com https:// e pertencer a um domínio docusign.com ou docusign.net.",
      });
    }
  });

// `id` NÃO faz parte do schema: o registro atualizado é sempre o lido pelo servidor (loadConfig).
const salvarConfigSchema = z.object({
  ambiente: z.enum(["demo", "producao"], { errorMap: () => ({ message: "Ambiente inválido." }) }),
  base_url: urlDocusignOpcional,
  auth_url: urlDocusignOpcional,
  account_id: z.string().trim().max(200, "Account ID muito longo."),
  integration_key: z.string().trim().max(200, "Integration Key muito longa."),
  impersonated_user_id: z.string().trim().max(200, "User ID muito longo."),
  // Em branco mantém a chave/segredo atuais (comportamento já existente).
  rsa_private_key: z.string().max(10_000, "Chave RSA muito longa.").optional(),
  default_template_id: z
    .string()
    .trim()
    .max(100, "Template padrão inválido.")
    .regex(/^[\w-]*$/, "Template padrão inválido.")
    .optional(),
  webhook_secret: z.string().max(200, "Webhook secret muito longo.").optional(),
  ativo: z.boolean().optional(),
});

export type DocusignConfigPublic = {
  id?: string;
  ambiente: "demo" | "producao";
  base_url: string;
  auth_url: string;
  account_id: string;
  integration_key: string;
  impersonated_user_id: string;
  default_template_id: string;
  rsa_private_key_configurada: boolean;
  webhook_secret_configurado: boolean;
  ativo: boolean;
  updated_at?: string | null;
};

type DocusignConfigRow = {
  id?: string;
  ambiente: "demo" | "producao";
  base_url: string;
  auth_url: string;
  account_id: string | null;
  integration_key: string | null;
  impersonated_user_id: string | null;
  // Valor da COLUNA: só tem conteúdo quando o segredo ainda não foi para o Vault (fallback). Com o
  // segredo no Vault a coluna é null; o valor vem de lerSegredoVault (ver "Segredos no Supabase Vault").
  rsa_private_key: string | null;
  default_template_id: string | null;
  webhook_secret: string | null;
  // Legado: o token de acesso NÃO é mais persistido (fica só em memória, ver tokenMem); sempre null.
  access_token_cache: string | null;
  access_token_expira_em: string | null;
  ativo: boolean;
  updated_at?: string | null;
};

type DocusignRecipient = {
  roleName?: string;
  recipientId?: string;
  tabs?: Record<string, unknown>;
};

type DocusignRecipientsResponse = {
  signers?: DocusignRecipient[];
  carbonCopies?: DocusignRecipient[];
};

const DEFAULT_MODELO_PLACEHOLDERS = ["nome", "cpf", "empreendimento", "bloco", "unidade"];

async function assertAdmin(ctx: DsCtx) {
  const { exigirPapel } = await import("@/lib/authz");
  await exigirPapel(ctx, ["admin", "super_admin"], "Sem permissão para administrar DocuSign.");
}

// Modelos, preview, PDF e envio de envelopes: perfis de trabalho (Analista, Admin, Super Admin) com a
// conta ativa. Qualquer JWT do projeto Supabase (compartilhado com outros sistemas Calper, papel
// padrão "cliente") NÃO pode acionar o DocuSign da empresa.
export async function assertOperacao(ctx: DsCtx) {
  const { exigirPapel } = await import("@/lib/authz");
  await exigirPapel(
    ctx,
    ["operadora", "admin", "super_admin"],
    "Seu perfil não tem acesso ao envio de documentos. Solicite o papel de operadora a um administrador.",
  );
}

// Campanha só pode ser consultada/reenviada por quem a criou ou por Admin/Super Admin.
export async function assertCampanhaDoUsuario(ctx: DsCtx, campanhaId: string | null | undefined) {
  if (!campanhaId) throw new Error("Campanha não informada.");
  const { temPapel } = await import("@/lib/authz");
  if (await temPapel(ctx, ["admin", "super_admin"])) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("wa_campanhas").select("criado_por").eq("id", campanhaId).maybeSingle();
  if (!data || data.criado_por !== ctx.userId) throw new Error("Você não tem acesso a esta campanha.");
}

// Envelope só pode ser consultado por quem tem acesso à campanha a que ele pertence. Envelopes sem
// vínculo com uma campanha do portal não são consultáveis por aqui (IDs são GUIDs da conta DocuSign
// inteira — inclusive de outros usos fora deste portal).
async function assertEnvelopeDoUsuario(ctx: DsCtx, envelopeId: string): Promise<{ campanha_id: string }> {
  if (!envelopeId || typeof envelopeId !== "string" || envelopeId.length > 100) throw new Error("Envelope inválido.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("wa_campanha_destinatarios")
    .select("campanha_id")
    .eq("envelope_docusign_id", envelopeId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Envelope não pertence a nenhuma campanha do portal.");
  await assertCampanhaDoUsuario(ctx, data.campanha_id);
  return { campanha_id: data.campanha_id };
}

// Credenciais (chave RSA, integration key…) só são alteradas por Super Admin — mesmo modelo das
// credenciais do TOTVS RM.
async function assertSuperAdmin(ctx: DsCtx) {
  const { exigirPapel, exigirAal2 } = await import("@/lib/authz");
  await exigirPapel(ctx, ["super_admin"], "Só um Super Admin altera as credenciais do DocuSign.");
  await exigirAal2(ctx); // segundo fator (TOTP) obrigatório para mexer em credenciais
}

function normalizeBaseUrl(url: string | null | undefined): string {
  const raw = (url ?? "").trim().replace(/\/+$/, "");
  if (!raw) return DEMO_BASE;
  // Se já contém /v2.x, mantém. Caso contrário, se termina em /restapi, acrescenta /v2.1.
  if (/\/v\d+(\.\d+)?$/i.test(raw)) return raw;
  if (/\/restapi$/i.test(raw)) return `${raw}/v2.1`;
  return raw;
}

async function loadConfig(_supabase?: any): Promise<DocusignConfigRow | null> {
  // Configuração de integração é compartilhada entre todos os perfis autenticados.
  // Lemos via service role (bypass RLS) para que qualquer usuário do wizard consuma
  // a configuração padrão salva pelos admins. Escritas continuam gated por assertAdmin.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("docusign_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw await erroGenerico("docusign.loadConfig", error, "Não foi possível ler a configuração do DocuSign.");
  if (!data) return null;
  const row = data as DocusignConfigRow;
  return { ...row, base_url: normalizeBaseUrl(row.base_url) };
}

// ---------- Segredos no Supabase Vault (auditoria de segurança, Fase 4 / M3) ----------
// A chave RSA privada e o webhook secret ficam criptografados no Vault (chave de criptografia fora do
// banco): um dump/backup lógico de docusign_config deixa de expô-los. As colunas rsa_private_key e
// webhook_secret passam a ser só FALLBACK; o app funciona em três estados:
//   1. migração 20261001170000_vault_segredos.sql não aplicada ou Vault inativo → segredo na coluna (como antes);
//   2. migração aplicada, segredo ainda na coluna → a coluna vale até o script de pós-migração movê-lo
//      (supabase/pos-migracao/20261001_mover_segredos_para_vault.sql);
//   3. segredo no Vault, coluna null → lido do Vault só quando preciso: a chave RSA, ao assinar um JWT
//      novo (o access token fica em memória por ~1 h; sem leitura a cada envelope); o webhook secret
//      só tem a existência consultada (nada no app o usa para validar assinatura).
// Nenhuma função daqui loga ou devolve o valor de um segredo; erros vão ao log só com o código/mensagem
// do banco (que não contém o valor).
const SEGREDO_RSA = "docusign_rsa_private_key";
const SEGREDO_WEBHOOK = "docusign_webhook_secret";

/** A RPC não existe (migração não aplicada) ou o Vault não está ativo: segue em texto claro. */
function vaultIndisponivel(e: { message?: string; code?: string } | null | undefined): boolean {
  return (
    e?.code === "PGRST202" ||
    e?.code === "42883" ||
    /vault_indisponivel|could not find the function|schema cache/i.test(e?.message ?? "")
  );
}

/** Grava no Vault. true = gravado (a coluna deve ficar null); false = Vault indisponível/falhou (cai para a coluna). */
async function gravarSegredoVault(nome: string, valor: string, descricao: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("wa_segredo_gravar", { p_nome: nome, p_valor: valor, p_descricao: descricao });
  if (!error) return true;
  // Vault ausente é esperado (estados 1 e 2); qualquer outra falha é registrada, mas não impede salvar.
  if (!vaultIndisponivel(error)) (await erros()).logErro("docusign.vault.gravar", error, { nome });
  return false;
}

/** Valor do segredo no Vault; null se não existir ou se o Vault estiver indisponível. */
async function lerSegredoVault(nome: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("wa_segredo_ler", { p_nome: nome });
  if (error) {
    if (vaultIndisponivel(error)) return null;
    throw await erroGenerico("docusign.vault.ler", error, "Não foi possível ler a chave RSA do DocuSign.");
  }
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** O segredo existe no Vault? (false se indisponível ou em caso de erro: só afeta o aviso "configurado"). */
async function segredoExisteVault(nome: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("wa_segredo_existe", { p_nome: nome });
  if (error) {
    if (!vaultIndisponivel(error)) (await erros()).logErro("docusign.vault.existe", error, { nome });
    return false;
  }
  return data === true;
}

/** Chave RSA e webhook secret estão configurados? Coluna OU Vault (consulta o Vault só se a coluna estiver vazia). */
async function segredosConfigurados(row: DocusignConfigRow | null): Promise<{ rsa: boolean; webhook: boolean }> {
  const [rsa, webhook] = await Promise.all([
    row?.rsa_private_key ? true : segredoExisteVault(SEGREDO_RSA),
    row?.webhook_secret ? true : segredoExisteVault(SEGREDO_WEBHOOK),
  ]);
  return { rsa, webhook };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = value?.replace(/\{\{|\}\}/g, "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function extractTabLabels(tabs: unknown): string[] {
  if (!tabs || typeof tabs !== "object") return [];

  const labels: string[] = [];
  for (const collection of Object.values(tabs as Record<string, unknown>)) {
    if (!Array.isArray(collection)) continue;
    for (const tab of collection) {
      if (!tab || typeof tab !== "object") continue;
      const t = tab as Record<string, unknown>;
      for (const key of ["tabLabel", "dataLabel", "name", "anchorString", "anchorTabString"]) {
        const value = t[key];
        if (typeof value === "string") labels.push(value);
      }
      const mergeField = t.mergeField;
      if (mergeField && typeof mergeField === "object") {
        for (const key of ["name", "originalValue", "value"]) {
          const value = (mergeField as Record<string, unknown>)[key];
          if (typeof value === "string") labels.push(value);
        }
      }
    }
  }
  return uniqueStrings(labels);
}

function extractRecipientPlaceholders(recipients: DocusignRecipient[]): string[] {
  return uniqueStrings(recipients.flatMap((recipient) => extractTabLabels(recipient.tabs)));
}

async function obterDetalhesTemplateDocusign(
  cfg: DocusignConfigRow,
  templateId: string,
): Promise<{ papeis: string[]; placeholders: string[] }> {
  const acc = encodeURIComponent(cfg.account_id!);
  const tpl = encodeURIComponent(templateId);
  const { data: recipients } = await docusignFetch<DocusignRecipientsResponse>(
    cfg,
    `/accounts/${acc}/templates/${tpl}/recipients?include_tabs=true`,
  );
  const signers = recipients.signers ?? [];
  let placeholders = extractRecipientPlaceholders(signers);

  if (placeholders.length === 0) {
    const perRecipient = await Promise.all(
      signers.map(async (signer) => {
        if (!signer.recipientId) return [];
        try {
          const { data: tabs } = await docusignFetch<Record<string, unknown>>(
            cfg,
            `/accounts/${acc}/templates/${tpl}/recipients/${encodeURIComponent(signer.recipientId)}/tabs`,
          );
          return extractTabLabels(tabs);
        } catch {
          return [];
        }
      }),
    );
    placeholders = uniqueStrings(perRecipient.flat());
  }

  return {
    papeis: uniqueStrings(signers.map((s) => s.roleName)),
    placeholders: uniqueStrings([...DEFAULT_MODELO_PLACEHOLDERS, ...placeholders]),
  };
}


function toPublic(
  row: DocusignConfigRow | null,
  segredos?: { rsa: boolean; webhook: boolean },
): DocusignConfigPublic {
  return {
    id: row?.id,
    ambiente: (row?.ambiente as "demo" | "producao") ?? "demo",
    base_url: row?.base_url ?? DEMO_BASE,
    auth_url: row?.auth_url ?? DEMO_AUTH,
    account_id: row?.account_id ?? "",
    integration_key: row?.integration_key ?? "",
    impersonated_user_id: row?.impersonated_user_id ?? "",
    default_template_id: row?.default_template_id ?? "",
    rsa_private_key_configurada: segredos?.rsa ?? Boolean(row?.rsa_private_key),
    webhook_secret_configurado: segredos?.webhook ?? Boolean(row?.webhook_secret),
    ativo: row?.ativo ?? true,
    updated_at: row?.updated_at ?? null,
  };
}

// ---------- JWT RS256 signing (Web Crypto) ----------

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = typeof atob !== "undefined" ? atob(cleaned) : Buffer.from(cleaned, "base64").toString("binary");
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

// ---------- ASN.1 DER helpers (para converter PKCS#1 → PKCS#8) ----------
function derLen(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}
function derTLV(tag: number, content: Uint8Array): Uint8Array {
  const len = derLen(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
// rsaEncryption OID 1.2.840.113549.1.1.1 já pré-codificado
const OID_RSA_ENCRYPTION = new Uint8Array([
  0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
]);
const NULL_DER = new Uint8Array([0x05, 0x00]);

function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  // PrivateKeyInfo ::= SEQUENCE { version 0, algorithm rsaEncryption NULL, privateKey OCTET STRING (pkcs1) }
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const algId = derTLV(0x30, concat(OID_RSA_ENCRYPTION, NULL_DER));
  const octet = derTLV(0x04, pkcs1);
  return derTLV(0x30, concat(version, algId, octet));
}

function normalizePrivateKeyToPkcs8(pem: string): ArrayBuffer {
  const trimmed = pem.trim();
  if (/BEGIN ENCRYPTED PRIVATE KEY/.test(trimmed)) {
    throw new Error(
      "Chave RSA está protegida por senha (ENCRYPTED PRIVATE KEY). Exporte uma versão sem senha.",
    );
  }
  if (/BEGIN PRIVATE KEY/.test(trimmed)) {
    // Já é PKCS#8
    return pemToArrayBuffer(trimmed);
  }
  if (/BEGIN RSA PRIVATE KEY/.test(trimmed)) {
    // PKCS#1 → precisa envelopar em PKCS#8
    const pkcs1 = new Uint8Array(pemToArrayBuffer(trimmed));
    const pkcs8 = pkcs1ToPkcs8(pkcs1);
    const ab = new ArrayBuffer(pkcs8.byteLength);
    new Uint8Array(ab).set(pkcs8);
    return ab;
  }
  // Sem cabeçalho reconhecido: tenta como PKCS#8 puro (base64 solto)
  return pemToArrayBuffer(trimmed);
}

async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  const keyData = normalizePrivateKeyToPkcs8(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(sig)}`;
}


// ---------- Token cache ----------
// O access token vive SÓ em memória (por instância do servidor, com expiração em expiresAt). Não é
// gravado no banco: docusign_config.access_token_cache / access_token_expira_em ficam sempre null
// (salvarConfigDocusign os zera). Instância nova ou token vencido → novo JWT, que lê a chave RSA.

type TokenCache = { token: string; expiresAt: number };
const tokenMem = new Map<string, TokenCache>();

async function getAccessToken(cfg: DocusignConfigRow): Promise<{ token: string; expiresIn: number }> {
  const cacheKey = `${cfg.auth_url}|${cfg.integration_key}|${cfg.impersonated_user_id}`;
  const now = Date.now();
  const cached = tokenMem.get(cacheKey);
  if (cached && cached.expiresAt > now + 30_000) {
    return { token: cached.token, expiresIn: Math.floor((cached.expiresAt - now) / 1000) };
  }

  // Coluna primeiro (fallback / valor mais recente); coluna vazia → Vault.
  const chaveRsa = cfg.rsa_private_key || (await lerSegredoVault(SEGREDO_RSA));
  if (!chaveRsa) throw new Error("Chave RSA privada não configurada.");
  if (!cfg.integration_key) throw new Error("Integration Key não configurada.");
  if (!cfg.impersonated_user_id) throw new Error("Impersonated User ID não configurado.");
  if (!cfg.auth_url) throw new Error("Auth URL não configurada.");

  const aud = cfg.auth_url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const iat = Math.floor(now / 1000);
  const payload = {
    iss: cfg.integration_key,
    sub: cfg.impersonated_user_id,
    aud,
    iat,
    exp: iat + 3600,
    scope: "signature impersonation",
  };

  let assertion: string;
  try {
    assertion = await signJwtRS256(payload, chaveRsa);
  } catch (e) {
    // A mensagem do Web Crypto não traz a chave, mas também não ajuda o usuário: fica só no log.
    throw await erroGenerico(
      "docusign.jwt",
      e,
      "Falha ao assinar o JWT. Confirme que a chave RSA está no formato PKCS#8 (BEGIN PRIVATE KEY).",
    );
  }

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const url = `${cfg.auth_url.replace(/\/+$/, "")}/oauth/token`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_DOCUSIGN_MS),
    });
  } catch (e) {
    (await erros()).logErro("docusign.auth", e, { url });
    throw new Error(ehTimeout(e) ? MSG_TIMEOUT_DOCUSIGN : MSG_REDE_DOCUSIGN);
  }
  const text = await res.text();

  if (!res.ok) {
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* noop */ }
    if (parsed?.error === "consent_required") {
      const consentUrl =
        `${cfg.auth_url.replace(/\/+$/, "")}/oauth/auth?response_type=code&scope=signature%20impersonation` +
        `&client_id=${encodeURIComponent(cfg.integration_key)}` +
        `&redirect_uri=${encodeURIComponent("https://developers.docusign.com/platform/auth/consent")}`;
      const err = new Error(`Consentimento necessário. Acesse a URL de consentimento para autorizar o app.`);
      (err as any).consentRequired = true;
      (err as any).consentUrl = consentUrl;
      throw err;
    }
    // Corpo (error/error_description) só no log; para o navegador vai o código OAuth ou o status.
    const { logErro, resumirErroDocusign } = await erros();
    logErro("docusign.auth", `HTTP ${res.status}: ${text}`, { url });
    const resumo = resumirErroDocusign(res.status, text);
    throw new ErroDocusign(res.status, typeof parsed?.error === "string" ? parsed.error : "", resumo);
  }

  const json = JSON.parse(text) as { access_token: string; expires_in: number; token_type: string };
  const expiresAt = now + json.expires_in * 1000;
  tokenMem.set(cacheKey, { token: json.access_token, expiresAt });

  return { token: json.access_token, expiresIn: json.expires_in };
}

// ---------- HTTP helper ----------

async function docusignFetch<T>(
  cfg: DocusignConfigRow,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T; rawText: string }> {
  const { token } = await getAccessToken(cfg);
  const url = `${cfg.base_url.replace(/\/+$/, "")}${path.startsWith("/") ? path : "/" + path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_DOCUSIGN_MS) });
  } catch (e) {
    (await erros()).logErro("docusign.fetch", e, { url, method: init.method ?? "GET" });
    throw new Error(ehTimeout(e) ? MSG_TIMEOUT_DOCUSIGN : MSG_REDE_DOCUSIGN);
  }
  const rawText = await res.text();
  if (!res.ok) {
    // O corpo (message/error_description, que pode trazer e-mail/nome do destinatário) fica só no
    // log; a mensagem que sobe (e que campanhas.functions grava em erro_msg) é só código/status.
    const { logErro, resumirErroDocusign } = await erros();
    logErro("docusign.fetch", `HTTP ${res.status}: ${rawText}`, { url, method: init.method ?? "GET" });
    let code = "";
    try {
      const parsed = JSON.parse(rawText) as { errorCode?: unknown; error?: unknown };
      code = typeof parsed?.errorCode === "string" ? parsed.errorCode : typeof parsed?.error === "string" ? parsed.error : "";
    } catch {
      /* noop */
    }
    throw new ErroDocusign(res.status, code, resumirErroDocusign(res.status, rawText));
  }
  const data = rawText ? (JSON.parse(rawText) as T) : ({} as T);
  return { status: res.status, data, rawText };
}

// ---------- Server functions ----------

export const carregarConfigDocusign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocusignConfigPublic> => {
    await assertAdmin(context as unknown as DsCtx);
    const row = await loadConfig(context.supabase);
    return toPublic(row, await segredosConfigurados(row));
  });

export const salvarConfigDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // A tela ainda envia `id`; ele é descartado pelo zod (strip) e ignorado aqui.
  .inputValidator(validar(salvarConfigSchema, "Dados da configuração DocuSign inválidos."))
  .handler(async ({ data, context }): Promise<DocusignConfigPublic> => {
    await assertSuperAdmin(context as unknown as DsCtx);
    const stored = await loadConfig(context.supabase);
    const ambiente = data.ambiente ?? stored?.ambiente ?? "demo";
    const defaults = ambiente === "producao"
      ? { base_url: PROD_BASE, auth_url: PROD_AUTH }
      : { base_url: DEMO_BASE, auth_url: DEMO_AUTH };

    // Em branco mantém o segredo atual (na coluna ou no Vault): nada é gravado nem lido.
    const novaRsa = data.rsa_private_key && data.rsa_private_key.trim().length > 0 ? data.rsa_private_key : null;
    const novoWh = data.webhook_secret && data.webhook_secret.trim().length > 0 ? data.webhook_secret : null;

    // Segredo novo vai para o Vault (coluna null). Sem Vault (migração não aplicada, extensão inativa ou
    // falha ao gravar) cai para a coluna, como antes.
    const rsaNoVault = novaRsa !== null && (await gravarSegredoVault(SEGREDO_RSA, novaRsa, "Chave RSA privada do DocuSign (JWT)"));
    const whNoVault = novoWh !== null && (await gravarSegredoVault(SEGREDO_WEBHOOK, novoWh, "Webhook secret do DocuSign"));

    const payload = {
      ambiente,
      base_url: data.base_url || defaults.base_url,
      auth_url: data.auth_url || defaults.auth_url,
      account_id: data.account_id,
      integration_key: data.integration_key,
      impersonated_user_id: data.impersonated_user_id,
      // As colunas de segredo só entram no UPDATE quando há valor novo (null se foi para o Vault).
      ...(novaRsa !== null ? { rsa_private_key: rsaNoVault ? null : novaRsa } : {}),
      default_template_id: (data.default_template_id ?? "").trim() || null,
      ...(novoWh !== null ? { webhook_secret: whNoVault ? null : novoWh } : {}),
      // O access token nunca é persistido (fica em memória, ver tokenMem).
      access_token_cache: null,
      access_token_expira_em: null,
      ativo: data.ativo ?? stored?.ativo ?? true,
      updated_by: context.userId,
    };

    // docusign_config fica fora da Data API (migração 20260930100000): grava com a service_role,
    // já garantido acima que só Super Admin chega aqui.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = stored?.id
      ? supabaseAdmin.from("docusign_config").update(payload).eq("id", stored.id).select("*").maybeSingle()
      : supabaseAdmin.from("docusign_config").insert(payload).select("*").maybeSingle();

    const { data: saved, error } = await query;
    if (error) throw await erroGenerico("docusign.salvarConfig", error, "Não foi possível salvar a configuração do DocuSign.");

    tokenMem.clear();

    const { auditar } = await import("@/lib/auditoria.server");
    await auditar({
      userId: context.userId,
      acao: "atualizar_integracao",
      entidade: "docusign_config",
      entidadeId: saved?.id ?? stored?.id ?? "novo",
      detalhes: {
        ambiente: payload.ambiente,
        account_id: payload.account_id,
        chave_rsa_alterada: !!data.rsa_private_key,
        webhook_secret_alterado: !!data.webhook_secret,
        segredos_no_vault: rsaNoVault || whNoVault,
      },
    });

    const salvo = saved as DocusignConfigRow | null;
    return toPublic(salvo, await segredosConfigurados(salvo));
  });

export type TestarConexaoDocusignResult = {
  ok: boolean;
  msg: string;
  status?: number;
  expiresIn?: number;
  accountName?: string;
  accountId?: string;
  consentRequired?: boolean;
  consentUrl?: string;
};

export const testarConexaoDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestarConexaoDocusignResult> => {
    await assertAdmin(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg) return { ok: false, msg: "DocuSign não configurado. Preencha e salve as credenciais primeiro." };
    try {
      const { token, expiresIn } = await getAccessToken(cfg);
      // Confirma o Account ID via /accounts/{id}
      const url = `${cfg.base_url.replace(/\/+$/, "")}/accounts/${encodeURIComponent(cfg.account_id ?? "")}`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_DOCUSIGN_MS),
        });
      } catch (e) {
        (await erros()).logErro("docusign.testarConexao", e, { url });
        return { ok: false, msg: ehTimeout(e) ? MSG_TIMEOUT_DOCUSIGN : MSG_REDE_DOCUSIGN };
      }
      const text = await res.text();
      if (!res.ok) {
        const { logErro, resumirErroDocusign } = await erros();
        logErro("docusign.testarConexao", `HTTP ${res.status}: ${text}`, { url });
        return { ok: false, status: res.status, msg: `Token obtido, mas a consulta da conta falhou: ${resumirErroDocusign(res.status, text)}` };
      }
      const parsed = JSON.parse(text) as { accountName?: string; accountIdGuid?: string };
      return {
        ok: true,
        status: res.status,
        expiresIn,
        accountName: parsed.accountName,
        accountId: parsed.accountIdGuid,
        msg: `Conexão OK. Token válido por ${expiresIn}s.`,
      };
    } catch (e: any) {
      if (e?.consentRequired) {
        return {
          ok: false,
          consentRequired: true,
          consentUrl: e.consentUrl,
          msg: "Consentimento pendente. Abra a URL de consentimento e autorize o app.",
        };
      }
      return { ok: false, msg: e instanceof Error ? e.message : "Falha desconhecida" };
    }
  });

export const obterUrlConsentimentoDocusign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string | null }> => {
    await assertAdmin(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.integration_key || !cfg?.auth_url) return { url: null };
    const url =
      `${cfg.auth_url.replace(/\/+$/, "")}/oauth/auth?response_type=code&scope=signature%20impersonation` +
      `&client_id=${encodeURIComponent(cfg.integration_key)}` +
      `&redirect_uri=${encodeURIComponent("https://developers.docusign.com/platform/auth/consent")}`;
    return { url };
  });

// ---------- Templates ----------

export type TemplateDocusign = {
  templateId: string;
  name: string;
  description?: string;
  lastModified?: string;
  shared?: string;
};

export const listarTemplatesDocusign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ templates: TemplateDocusign[]; error?: string }> => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) return { templates: [], error: "DocuSign não configurado." };
    try {
      const { data } = await docusignFetch<{ envelopeTemplates?: TemplateDocusign[] }>(
        cfg,
        `/accounts/${encodeURIComponent(cfg.account_id)}/templates?shared=false&count=100`,
      );
      return { templates: data.envelopeTemplates ?? [] };
    } catch (e) {
      return { templates: [], error: e instanceof Error ? e.message : "Erro ao listar templates" };
    }
  });

export const obterTemplateDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ templateId: templateIdSchema })))
  .handler(async ({ data, context }) => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) throw new Error("DocuSign não configurado.");
    const acc = encodeURIComponent(cfg.account_id);
    const tpl = encodeURIComponent(data.templateId);
    const [detalhes, roles, documentos] = await Promise.all([
      docusignFetch<any>(cfg, `/accounts/${acc}/templates/${tpl}`),
      docusignFetch<{ signers?: any[]; carbonCopies?: any[] }>(cfg, `/accounts/${acc}/templates/${tpl}/recipients`),
      docusignFetch<{ templateDocuments?: any[] }>(cfg, `/accounts/${acc}/templates/${tpl}/documents`),
    ]);
    return {
      detalhes: detalhes.data,
      signers: roles.data.signers ?? [],
      carbonCopies: roles.data.carbonCopies ?? [],
      documentos: documentos.data.templateDocuments ?? [],
    };
  });

// ---------- Preview de template (auditoria de segurança, Fase 2 / N2) ----------

// Origem pública do portal (ex.: https://portal.exemplo.com.br). Fixa, no servidor, o returnUrl e os
// frameAncestors/messageOrigins do preview: antes o navegador escolhia essas URLs, o que permitia
// abrir a sessão de preview (com documentos reais do template) em qualquer origem.
function appOrigin(): string {
  const raw = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("APP_URL não configurada no servidor.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("APP_URL inválida no servidor (use a origem completa, ex.: https://portal.exemplo.com.br).");
  }
  // Só https; http apenas para desenvolvimento local.
  const local = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !local) throw new Error("APP_URL precisa começar com https://.");
  return u.origin;
}

// Limite de previews por usuário: cada preview cria um envelope na conta DocuSign (consome API e,
// no fallback, cota de envio). Contador em memória do módulo — na Vercel vale por instância quente,
// então o limite real pode ser um pouco maior que 20/h quando há várias instâncias; é suficiente
// para frear abuso sem precisar de tabela.
const PREVIEW_LIMITE_POR_HORA = 20;
const PREVIEW_JANELA_MS = 60 * 60 * 1000;
const previewsPorUsuario = new Map<string, number[]>();

function registrarPreviewDoUsuario(userId: string): void {
  const agora = Date.now();
  const recentes = (previewsPorUsuario.get(userId) ?? []).filter((t) => agora - t < PREVIEW_JANELA_MS);
  if (recentes.length >= PREVIEW_LIMITE_POR_HORA) {
    throw new Error(`Limite de ${PREVIEW_LIMITE_POR_HORA} previews por hora atingido. Tente novamente mais tarde.`);
  }
  recentes.push(agora);
  previewsPorUsuario.set(userId, recentes);
  if (previewsPorUsuario.size > 500) {
    for (const [k, v] of previewsPorUsuario) {
      if (!v.some((t) => agora - t < PREVIEW_JANELA_MS)) previewsPorUsuario.delete(k);
    }
  }
}

// Descarte dos envelopes de preview. A URL devolvida ao navegador só funciona enquanto o envelope
// existe (a sessão é aberta pelo iframe DEPOIS desta função retornar), então o descarte imediato
// quebraria o preview. Estratégia:
//   · falhou antes de devolver a URL → descarta no `finally`, na hora;
//   · sucesso → fica em `previewsPendentes` e é descartado na próxima chamada, depois de
//     PREVIEW_TTL_MS (a URL de view do DocuSign expira em 5 min);
//   · envelopes criados em outra instância (Vercel) são achados pelo custom field
//     `portal_preview=1` e descartados na varredura periódica (máx. 1x a cada 5 min por instância).
// Rascunho (`created`): a API não tem DELETE de envelope — o descarte é mover para a lixeira
// (PUT /folders/recyclebin). Enviado (`sent`, só no fallback): void.
const PREVIEW_CUSTOM_FIELD = "portal_preview";
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const PREVIEW_VARREDURA_MS = 5 * 60 * 1000;
type PreviewPendente = { envelopeId: string; status: "created" | "sent"; criadoEm: number };
const previewsPendentes: PreviewPendente[] = [];
let ultimaVarreduraPreview = 0;

async function descartarEnvelopePreview(cfg: DocusignConfigRow, acc: string, p: PreviewPendente): Promise<void> {
  if (p.status === "sent") {
    await docusignFetch(cfg, `/accounts/${acc}/envelopes/${encodeURIComponent(p.envelopeId)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "voided", voidedReason: "preview" }),
    });
  } else {
    await docusignFetch(cfg, `/accounts/${acc}/folders/recyclebin`, {
      method: "PUT",
      body: JSON.stringify({ envelopeIds: [p.envelopeId] }),
    });
  }
}

async function limparPreviewsAntigos(cfg: DocusignConfigRow, acc: string): Promise<void> {
  const agora = Date.now();
  for (let i = previewsPendentes.length - 1; i >= 0; i--) {
    const p = previewsPendentes[i];
    if (agora - p.criadoEm < PREVIEW_TTL_MS) continue;
    previewsPendentes.splice(i, 1);
    try {
      await descartarEnvelopePreview(cfg, acc, p);
    } catch (e) {
      console.warn("[docusign] falha ao descartar envelope de preview:", e instanceof Error ? e.message : e);
    }
  }

  if (agora - ultimaVarreduraPreview < PREVIEW_VARREDURA_MS) return;
  ultimaVarreduraPreview = agora;
  try {
    const desde = new Date(agora - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await docusignFetch<{ envelopes?: Array<{ envelopeId?: string; status?: string; createdDateTime?: string }> }>(
      cfg,
      `/accounts/${acc}/envelopes?from_date=${encodeURIComponent(desde)}&status=created,sent` +
        `&custom_field=${encodeURIComponent(`${PREVIEW_CUSTOM_FIELD}=1`)}&count=50`,
    );
    for (const env of data.envelopes ?? []) {
      if (!env.envelopeId) continue;
      const criadoEm = env.createdDateTime ? Date.parse(env.createdDateTime) : 0;
      if (agora - criadoEm < PREVIEW_TTL_MS) continue;
      if (previewsPendentes.some((p) => p.envelopeId === env.envelopeId)) continue;
      try {
        await descartarEnvelopePreview(cfg, acc, {
          envelopeId: env.envelopeId,
          status: (env.status ?? "").toLowerCase() === "sent" ? "sent" : "created",
          criadoEm,
        });
      } catch {
        /* melhor esforço */
      }
    }
  } catch (e) {
    console.warn("[docusign] varredura de previews órfãos falhou:", e instanceof Error ? e.message : e);
  }
}

export const gerarPreviewTemplateDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // `returnUrl`, `allowFromUrl`, `frameAncestors` e `messageOrigins` que a tela ainda envia são
  // IGNORADOS (strip do zod): tudo é fixado no servidor a partir de APP_URL. As telas continuam
  // compilando porque o input do validador é `unknown`.
  .inputValidator(validar(z.object({
    templateId: templateIdSchema,
    recipientId: z.string().trim().max(100, "Destinatário inválido.").optional(),
  })))
  .handler(async ({ data, context }): Promise<{
    url: string | null;
    envelopeId?: string;
    integrationKey?: string;
    ambiente?: "demo" | "producao";
    docusignJsUrl?: string;
    error?: string;
  }> => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) return { url: null, error: "DocuSign não configurado." };
    if (!cfg.integration_key) return { url: null, error: "Integration Key DocuSign não configurada." };

    let origem: string;
    try {
      origem = appOrigin();
      registrarPreviewDoUsuario(context.userId);
    } catch (e) {
      return { url: null, error: e instanceof Error ? e.message : "Preview indisponível." };
    }

    const acc = encodeURIComponent(cfg.account_id);
    const tpl = encodeURIComponent(data.templateId);
    const returnUrl = `${origem}/configuracoes/docusign`;
    const isProducao = cfg.ambiente === "producao";
    const docusignJsUrl = isProducao ? "https://js.docusign.com/bundle.js" : "https://js-d.docusign.com/bundle.js";
    const frameAncestors = Array.from(new Set([origem, "https://apps-d.docusign.com", "https://apps.docusign.com"]));
    const messageOrigins = frameAncestors;

    await limparPreviewsAntigos(cfg, acc);

    let pendente: PreviewPendente | null = null;
    try {
      const { data: templateRecipients } = await docusignFetch<{ signers?: any[]; carbonCopies?: any[] }>(
        cfg,
        `/accounts/${acc}/templates/${tpl}/recipients`,
      );

      const signers = (templateRecipients.signers ?? []).filter((s) => Boolean(s.roleName));
      if (signers.length === 0) {
        return { url: null, error: "Este template não possui papel de assinante configurado para preview." };
      }

      const selectedIndex = data.recipientId
        ? Math.max(0, signers.findIndex((s) => String(s.recipientId) === String(data.recipientId)))
        : 0;

      const draftSigners = signers.map((s, i) => ({
        email: `preview-assinante-${i + 1}@example.com`,
        name: s.name || s.roleName || `Assinante ${i + 1}`,
        roleName: s.roleName,
        recipientId: String(s.recipientId ?? i + 1),
        routingOrder: String(s.routingOrder ?? i + 1),
        clientUserId: `preview-${i + 1}`,
      }));
      const selectedSigner = draftSigners[selectedIndex] ?? draftSigners[0];
      if (!selectedSigner) {
        return { url: null, error: "Não foi possível identificar o assinante para preview." };
      }

      const carbonCopies = (templateRecipients.carbonCopies ?? [])
        .filter((cc) => Boolean(cc.roleName))
        .map((cc, i) => ({
          email: `preview-copia-${i + 1}@example.com`,
          name: cc.name || cc.roleName || `Cópia ${i + 1}`,
          roleName: cc.roleName,
          recipientId: String(cc.recipientId ?? 100 + i),
          routingOrder: String(cc.routingOrder ?? 100 + i),
        }));

      // Rascunho (`created`), não `sent`: nada é enviado a ninguém e o envelope some da lixeira sem
      // contar como envio. O custom field marca o envelope para a varredura de órfãos.
      const { data: envelope } = await docusignFetch<{ envelopeId: string; status?: string }>(
        cfg,
        `/accounts/${acc}/envelopes`,
        {
          method: "POST",
          body: JSON.stringify({
            status: "created",
            emailSubject: "Preview do template DocuSign",
            customFields: { textCustomFields: [{ name: PREVIEW_CUSTOM_FIELD, value: "1", show: "false", required: "false" }] },
            compositeTemplates: [{
              compositeTemplateId: "1",
              serverTemplates: [{ sequence: "1", templateId: data.templateId }],
              inlineTemplates: [{
                sequence: "2",
                recipients: {
                  signers: draftSigners,
                  ...(carbonCopies.length > 0 ? { carbonCopies } : {}),
                },
              }],
            }],
          }),
        },
      );
      pendente = { envelopeId: envelope.envelopeId, status: "created", criadoEm: Date.now() };
      const envPath = `/accounts/${acc}/envelopes/${encodeURIComponent(envelope.envelopeId)}`;

      const { data: draftRecipients } = await docusignFetch<{ signers?: any[] }>(cfg, `${envPath}/recipients`);
      const previewSigner = (draftRecipients.signers ?? [])[selectedIndex] ?? (draftRecipients.signers ?? [])[0];
      const previewRecipientId = String(previewSigner?.recipientId ?? selectedSigner.recipientId);
      const previewUserId = previewSigner?.userId ? String(previewSigner.userId) : undefined;

      let url: string | null = null;
      try {
        // EnvelopeViews:createRecipientPreview — é a view de "preview do destinatário" feita para
        // rascunhos (fluxo "Preview and Send" do DocuSign); aceita frameAncestors/messageOrigins
        // para o embed com docusign.js, igual à recipient view.
        const { data: preview } = await docusignFetch<{ url?: string }>(cfg, `${envPath}/views/recipient_preview`, {
          method: "POST",
          body: JSON.stringify({
            recipientId: previewRecipientId,
            returnUrl,
            authenticationMethod: "none",
            frameAncestors,
            messageOrigins,
          }),
        });
        url = preview.url ?? null;
      } catch (e) {
        // Fallback só para erro da API (conta sem o recipient_preview): envia o rascunho e usa a
        // recipient view clássica (exige envelope `sent`). O envelope passa a `sent` e é anulado
        // (void) no descarte. Erro de rede/auth não cai aqui.
        if (!(e instanceof ErroDocusign) || e.status === 401 || e.status === 403) throw e;
        console.warn("[docusign] recipient_preview indisponível, usando recipient view:", e.message);
        await docusignFetch(cfg, envPath, { method: "PUT", body: JSON.stringify({ status: "sent" }) });
        pendente.status = "sent";
        const { data: preview } = await docusignFetch<{ url?: string }>(cfg, `${envPath}/views/recipient`, {
          method: "POST",
          body: JSON.stringify({
            returnUrl,
            authenticationMethod: "none",
            email: selectedSigner.email,
            userName: selectedSigner.name,
            clientUserId: selectedSigner.clientUserId,
            recipientId: previewRecipientId,
            ...(previewUserId ? { userId: previewUserId } : {}),
            frameAncestors,
            messageOrigins,
          }),
        });
        url = preview.url ?? null;
      }
      if (!url) return { url: null, error: "DocuSign não devolveu a URL do preview." };

      // Sucesso: o descarte fica para depois (ver limparPreviewsAntigos).
      previewsPendentes.push(pendente);
      pendente = null;
      return {
        url,
        envelopeId: envelope.envelopeId,
        integrationKey: cfg.integration_key,
        ambiente: cfg.ambiente,
        docusignJsUrl,
      };
    } catch (e) {
      return { url: null, error: e instanceof Error ? e.message : "Erro ao gerar preview" };
    } finally {
      // Não chegou a devolver uma URL: o envelope não serve para nada, descarta já.
      if (pendente) {
        try {
          await descartarEnvelopePreview(cfg, acc, pendente);
        } catch (e) {
          console.warn("[docusign] falha ao descartar envelope de preview:", e instanceof Error ? e.message : e);
        }
      }
    }
  });

export const obterTemplatePdfDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ templateId: templateIdSchema })))
  .handler(async ({ data, context }): Promise<{ pdfBase64: string | null; error?: string }> => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) return { pdfBase64: null, error: "DocuSign não configurado." };
    try {
      const { token } = await getAccessToken(cfg);
      const url = `${cfg.base_url.replace(/\/+$/, "")}/accounts/${encodeURIComponent(cfg.account_id)}/templates/${encodeURIComponent(data.templateId)}/documents/combined`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
          signal: AbortSignal.timeout(TIMEOUT_PDF_DOCUSIGN_MS),
        });
      } catch (e) {
        (await erros()).logErro("docusign.pdf", e, { url });
        return { pdfBase64: null, error: ehTimeout(e) ? MSG_TIMEOUT_DOCUSIGN : MSG_REDE_DOCUSIGN };
      }
      if (!res.ok) {
        const txt = await res.text();
        const { logErro, resumirErroDocusign } = await erros();
        logErro("docusign.pdf", `HTTP ${res.status}: ${txt}`, { url });
        return { pdfBase64: null, error: `Não foi possível obter o PDF do modelo: ${resumirErroDocusign(res.status, txt)}` };
      }
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(bin);
      return { pdfBase64: b64 };
    } catch (e) {
      return { pdfBase64: null, error: e instanceof Error ? e.message : "Erro ao obter PDF" };
    }
  });


// ---------- Envelopes ----------

export type SignerInput = {
  email: string;
  name: string;
  roleName: string;
  tabs?: Record<string, string>;
  whatsapp?: { countryCode: string; number: string };
};

export type CarbonCopyInput = {
  email: string;
  name: string;
  roleName?: string;
};

function toDocusignSupportedLanguage(idioma: string | undefined): string {
  if (idioma === "pt-BR") return "pt_BR";
  if (idioma === "es") return "es";
  return "en";
}

export type EnvioEnvelopeInput = {
  templateId: string;
  emailSubject: string;
  messageBody?: string;
  idioma?: "pt-BR" | "en-US" | "es";
  signers: SignerInput[];
  carbonCopies?: CarbonCopyInput[];
  viaWhatsapp?: boolean;
  campanhaId: string;
  destinatarioId: string;
};

export type EnvioEnvelopeResultado = { envelopeId: string | null; status?: string; error?: string; warning?: string };

/** O template existe na conta DocuSign configurada? (evita enviar um templateId de outra conta) */
export async function templateExisteDocusign(templateId: string): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg?.account_id) throw new Error("DocuSign não configurado.");
  try {
    await docusignFetch<{ templateId?: string }>(
      cfg,
      `/accounts/${encodeURIComponent(cfg.account_id)}/templates/${encodeURIComponent(templateId)}`,
    );
    return true;
  } catch (e) {
    if (e instanceof ErroDocusign && (e.status === 404 || /^TEMPLATE_(ID_INVALID|NOT_FOUND)$/.test(e.code))) return false;
    throw e;
  }
}

// Envio de um envelope. NÃO é server function: só o servidor chama (src/lib/campanhas.functions.ts,
// depois de validar destinatário, modelo e dono da campanha). O navegador não monta mais
// signatários nem escolhe o template — auditoria de segurança 2026-10-01, item C2.
export async function enviarEnvelopeCore(data: EnvioEnvelopeInput): Promise<EnvioEnvelopeResultado> {
    const cfg = await loadConfig();
    if (!cfg?.account_id) return { envelopeId: null, error: "DocuSign não configurado." };
    const supportedLanguage = toDocusignSupportedLanguage(data.idioma);
    const customSubject = data.emailSubject;
    const customBody = data.messageBody?.trim() ?? "";

    // Nota: para o WhatsApp/e-mail do DocuSign sair no idioma do destinatário,
    // é necessário setar `emailNotification` por destinatário com `supportedLanguage`.
    // Alguns planos exigem a permissão "Recipient Language Selection" — se falhar,
    // fazemos fallback removendo essa customização.
    const buildBody = (opts: { includeWhatsapp: boolean; perRecipientLanguage: boolean }) => {
      const emailNotification = opts.perRecipientLanguage
        ? (customBody
            ? { emailSubject: customSubject, emailBody: customBody, supportedLanguage }
            : { emailSubject: customSubject, supportedLanguage })
        : null;

      if (opts.includeWhatsapp) {
        return {
          status: "sent",
          emailSubject: customSubject,
          ...(customBody ? { emailBlurb: customBody } : {}),
          compositeTemplates: [{
            compositeTemplateId: "1",
            serverTemplates: [{ sequence: "1", templateId: data.templateId }],
            inlineTemplates: [{
              sequence: "2",
              recipients: {
                signers: data.signers.map((s, i) => ({
                  email: s.email,
                  name: s.name,
                  recipientId: String(i + 1),
                  routingOrder: String(i + 1),
                  roleName: s.roleName,
                  ...(emailNotification ? { emailNotification } : {}),
                  ...(s.tabs ? { tabs: { textTabs: Object.entries(s.tabs).map(([tabLabel, value]) => ({ tabLabel, value })) } } : {}),
                  ...(s.whatsapp ? {
                    additionalNotifications: [{
                      secondaryDeliveryMethod: "WhatsApp",
                      phoneNumber: { countryCode: s.whatsapp.countryCode, number: s.whatsapp.number },
                      supportedLanguage,
                    }],
                  } : {}),
                })),
              },
            }],
          }],
        } as any;
      }
      return {
        status: "sent",
        emailSubject: customSubject,
        ...(customBody ? { emailBlurb: customBody } : {}),
        templateId: data.templateId,
        templateRoles: data.signers.map((s) => ({
          email: s.email,
          name: s.name,
          roleName: s.roleName,
          ...(emailNotification ? { emailNotification } : {}),
          ...(s.tabs ? { tabs: { textTabs: Object.entries(s.tabs).map(([tabLabel, value]) => ({ tabLabel, value })) } } : {}),
        })),
        ...(data.carbonCopies && data.carbonCopies.length > 0 ? {
          recipients: {
            carbonCopies: data.carbonCopies.map((cc, i) => ({
              email: cc.email,
              name: cc.name,
              recipientId: String(100 + i),
              routingOrder: String(100 + i),
              ...(cc.roleName ? { roleName: cc.roleName } : {}),
            })),
          },
        } : {}),
      } as any;
    };


    const doSend = async (opts: { includeWhatsapp: boolean; perRecipientLanguage: boolean }) => {
      const body = buildBody(opts);
      const { data: env } = await docusignFetch<{ envelopeId: string; status: string; statusDateTime?: string }>(
        cfg,
        `/accounts/${encodeURIComponent(cfg.account_id!)}/envelopes`,
        { method: "POST", body: JSON.stringify(body) },
      );
      return env;
    };

    let warning: string | undefined;
    try {
      let env: { envelopeId: string; status: string; statusDateTime?: string };
      const wa = Boolean(data.viaWhatsapp);
      try {
        env = await doSend({ includeWhatsapp: wa, perRecipientLanguage: true });
      } catch (e1) {
        const msg1 = e1 instanceof Error ? e1.message : String(e1);
        const lacksLanguage = /USER_LACKS_|RECIPIENT_LANGUAGE|SUPPORTEDLANGUAGE|EMAIL_NOTIFICATION/i.test(msg1);
        if (!lacksLanguage && wa) {
          const lacksWhatsapp = /WHATSAPP|SMS_NOT|SECONDARY_DELIVERY/i.test(msg1);
          if (!lacksWhatsapp) throw e1;
          warning = "Conta DocuSign sem permissão para WhatsApp — envelope enviado apenas por e-mail.";
          env = await doSend({ includeWhatsapp: false, perRecipientLanguage: true });
        } else if (lacksLanguage) {
          // Retry without per-recipient language (mensagem sairá no idioma padrão da conta)
          try {
            env = await doSend({ includeWhatsapp: wa, perRecipientLanguage: false });
            warning = "Conta DocuSign sem permissão para definir idioma por destinatário — mensagem enviada no idioma padrão da conta.";
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2);
            const lacksWhatsapp = wa && /WHATSAPP|SMS_NOT|SECONDARY_DELIVERY|USER_LACKS_/i.test(msg2);
            if (!lacksWhatsapp) throw e2;
            warning = "Conta DocuSign sem permissão para WhatsApp — envelope enviado apenas por e-mail.";
            env = await doSend({ includeWhatsapp: false, perRecipientLanguage: false });
          }
        } else {
          throw e1;
        }
      }


      // Registro do envelope com a service_role: a tabela é admin-only na Data API e, com o JWT de
      // uma Analista, o insert falhava em silêncio (envelope enviado sem rastro).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: regErr } = await supabaseAdmin.from("docusign_envelopes").insert({
        campanha_id: data.campanhaId,
        destinatario_id: data.destinatarioId,
        envelope_id: env.envelopeId,
        template_id: data.templateId,
        status: env.status,
        sent_at: env.statusDateTime ?? new Date().toISOString(),
        raw: env as any,
      });
      if (regErr) console.error("[docusign] falha ao registrar envelope:", regErr.message);

      return { envelopeId: env.envelopeId, status: env.status, warning };
    } catch (e) {
      return { envelopeId: null, error: e instanceof Error ? e.message : "Erro ao enviar envelope" };
    }
}


async function aplicarStatusEnvelope(
  _supabase: any,
  envelopeId: string,
  env: { status?: string; completedDateTime?: string; declinedDateTime?: string; voidedDateTime?: string; deliveredDateTime?: string; sentDateTime?: string; statusChangedDateTime?: string },
): Promise<{ changed: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const statusRaw = (env.status ?? "").toLowerCase();
  const now = new Date().toISOString();

  const envUpdate: Record<string, unknown> = {
    status: env.status ?? null,
    last_event_at: env.statusChangedDateTime ?? now,
    raw: env as any,
  };
  if (env.completedDateTime) envUpdate.completed_at = env.completedDateTime;
  if (env.sentDateTime) envUpdate.sent_at = env.sentDateTime;
  if (env.declinedDateTime) envUpdate.declined_at = env.declinedDateTime;
  if (env.voidedDateTime) envUpdate.voided_at = env.voidedDateTime;

  await supabaseAdmin.from("docusign_envelopes").update(envUpdate as any).eq("envelope_id", envelopeId);

  // Ler destinatário para não sobrescrever status finais e detectar mudança.
  const { data: destRow } = await supabaseAdmin
    .from("wa_campanha_destinatarios")
    .select("id, status, assinado_em")
    .eq("envelope_docusign_id", envelopeId)
    .maybeSingle();

  if (!destRow) return { changed: false };

  const destUpdate: Record<string, unknown> = {};
  if (["completed", "signed"].includes(statusRaw)) {
    if (destRow.status !== "assinado") {
      destUpdate.status = "assinado";
      destUpdate.assinado_em = env.completedDateTime ?? env.statusChangedDateTime ?? now;
    }
  } else if (["declined", "voided"].includes(statusRaw)) {
    if (destRow.status !== "erro") {
      destUpdate.status = "erro";
      destUpdate.erro_msg = statusRaw === "declined" ? "Envelope recusado no DocuSign" : "Envelope cancelado no DocuSign";
    }
  } else if (["delivered", "sent"].includes(statusRaw)) {
    if (destRow.status === "pendente") destUpdate.status = "enviado";
  }

  if (Object.keys(destUpdate).length === 0) return { changed: false };
  destUpdate.updated_at = now;
  const { error: upErr } = await supabaseAdmin
    .from("wa_campanha_destinatarios")
    .update(destUpdate as any)
    .eq("id", destRow.id);
  if (upErr) throw await erroGenerico("docusign.aplicarStatus", upErr, "Não foi possível atualizar o status do destinatário.");
  return { changed: true };
}

export const consultarStatusEnvelopeDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { envelopeId: string }) => ({ envelopeId: String(input?.envelopeId ?? "").slice(0, 100) }))
  .handler(async ({ data, context }) => {
    await assertOperacao(context as unknown as DsCtx);
    await assertEnvelopeDoUsuario(context as unknown as DsCtx, data.envelopeId);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) throw new Error("DocuSign não configurado.");
    const { data: env } = await docusignFetch<any>(
      cfg,
      `/accounts/${encodeURIComponent(cfg.account_id)}/envelopes/${encodeURIComponent(data.envelopeId)}`,
    );
    await aplicarStatusEnvelope(context.supabase, data.envelopeId, env);
    return env;
  });




export const refreshEnvelopesCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ campanhaId: z.string().uuid("Campanha inválida.") })))
  .handler(async ({ data, context }): Promise<{ atualizados: number; erros: number; total: number }> => {
    await assertOperacao(context as unknown as DsCtx);
    await assertCampanhaDoUsuario(context as unknown as DsCtx, data.campanhaId);
    const cfg = await loadConfig();
    if (!cfg?.account_id) return { atualizados: 0, erros: 0, total: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só consulta destinatários que ainda podem mudar de status.
    const { data: dests, error: dErr } = await supabaseAdmin
      .from("wa_campanha_destinatarios")
      .select("id, envelope_docusign_id, status")
      .eq("campanha_id", data.campanhaId)
      .not("envelope_docusign_id", "is", null)
      .not("status", "in", "(assinado,erro,opt_out)")
      .limit(2000);
    if (dErr) throw await erroGenerico("docusign.refresh", dErr, "Não foi possível ler os destinatários da campanha.");

    const { data: envs, error } = await supabaseAdmin
      .from("docusign_envelopes")
      .select("envelope_id, status")
      .eq("campanha_id", data.campanhaId)
      .limit(2000);
    if (error) throw await erroGenerico("docusign.refresh", error, "Não foi possível ler os envelopes da campanha.");

    const FINAL_ENV_STATUS = new Set(["completed", "signed", "declined", "voided"]);
    const envStatusMap = new Map<string, string | null>();
    for (const e of (envs ?? []) as { envelope_id: string; status: string | null }[]) {
      if (e.envelope_id) envStatusMap.set(e.envelope_id, (e.status ?? "").toLowerCase() || null);
    }

    const envelopeIds = new Set<string>();
    for (const d of (dests ?? []) as { id: string; envelope_docusign_id: string | null }[]) {
      const envId = d.envelope_docusign_id;
      if (!envId) continue;
      const envStatus = envStatusMap.get(envId);
      if (envStatus && FINAL_ENV_STATUS.has(envStatus)) continue;
      envelopeIds.add(envId);
      if (!envStatusMap.has(envId)) {
        await supabaseAdmin.from("docusign_envelopes").insert({
          campanha_id: data.campanhaId,
          destinatario_id: d.id,
          envelope_id: envId,
          status: null,
        } as any).then(() => undefined, () => undefined);
      }
    }

    const lista = Array.from(envelopeIds);
    let atualizados = 0;
    let erros = 0;
    const CONCURRENCY = 12;
    for (let i = 0; i < lista.length; i += CONCURRENCY) {
      const chunk = lista.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(async (envelope_id) => {
        const { data: env } = await docusignFetch<any>(
          cfg,
          `/accounts/${encodeURIComponent(cfg.account_id!)}/envelopes/${encodeURIComponent(envelope_id)}`,
        );
        return aplicarStatusEnvelope(null, envelope_id, env);
      }));
      for (const r of results) {
        if (r.status === "fulfilled") {
          if (r.value?.changed) atualizados++;
        } else {
          erros++;
        }
      }
    }

    return { atualizados, erros, total: lista.length };
  });

export const listarDestinatariosEnvelopeDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { envelopeId: string }) => ({ envelopeId: String(input?.envelopeId ?? "").slice(0, 100) }))
  .handler(async ({ data, context }) => {
    await assertOperacao(context as unknown as DsCtx);
    await assertEnvelopeDoUsuario(context as unknown as DsCtx, data.envelopeId);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) throw new Error("DocuSign não configurado.");
    const { data: rec } = await docusignFetch<{ signers?: any[]; carbonCopies?: any[] }>(
      cfg,
      `/accounts/${encodeURIComponent(cfg.account_id)}/envelopes/${encodeURIComponent(data.envelopeId)}/recipients`,
    );
    return { signers: rec.signers ?? [], carbonCopies: rec.carbonCopies ?? [] };
  });

// ---------- Wizard bridge (mantém compat com o passo Modelo) ----------

export const listarModelosDocusign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ modelos: ModeloDocusign[]; error?: string; stub?: boolean }> => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (
      !cfg?.account_id ||
      !cfg?.integration_key ||
      !(cfg.rsa_private_key || (await segredoExisteVault(SEGREDO_RSA)))
    ) {
      return { modelos: [], error: "DocuSign não configurado. Preencha em Configurações → Integração DocuSign.", stub: true };
    }
    try {
      const { data } = await docusignFetch<{ envelopeTemplates?: TemplateDocusign[] }>(
        cfg,
        `/accounts/${encodeURIComponent(cfg.account_id)}/templates?shared=false&count=100`,
      );
      const templates = data.envelopeTemplates ?? [];
      // Buscar papéis e variáveis em paralelo (limitado a 20)
      const alvo = templates.slice(0, 20);
      const detalhes = await Promise.all(alvo.map(async (t) => {
        try {
          const detalhesTemplate = await obterDetalhesTemplateDocusign(cfg, t.templateId);
          return {
            id: t.templateId,
            nome: t.name,
            descricao: t.description ?? "",
            papeis: detalhesTemplate.papeis,
            placeholders: detalhesTemplate.placeholders,
          } satisfies ModeloDocusign;
        } catch {
          return { id: t.templateId, nome: t.name, descricao: t.description ?? "", papeis: [], placeholders: DEFAULT_MODELO_PLACEHOLDERS } satisfies ModeloDocusign;
        }
      }));
      return { modelos: detalhes };
    } catch (e) {
      return { modelos: [], error: e instanceof Error ? e.message : "Erro ao listar templates DocuSign" };
    }
  });

export const obterModeloDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ id: templateIdSchema })))
  .handler(async ({ data, context }): Promise<{ modelo: ModeloDocusign | null; error?: string }> => {
    await assertOperacao(context as unknown as DsCtx);
    const cfg = await loadConfig(context.supabase);
    if (!cfg?.account_id) return { modelo: null, error: "DocuSign não configurado." };
    try {
      const acc = encodeURIComponent(cfg.account_id);
      const tpl = encodeURIComponent(data.id);
      const [d, detalhesTemplate] = await Promise.all([
        docusignFetch<any>(cfg, `/accounts/${acc}/templates/${tpl}`),
        obterDetalhesTemplateDocusign(cfg, data.id),
      ]);
      return {
        modelo: {
          id: data.id,
          nome: d.data.name ?? "",
          descricao: d.data.description ?? "",
          papeis: detalhesTemplate.papeis,
          placeholders: detalhesTemplate.placeholders,
        },
      };
    } catch (e) {
      return { modelo: null, error: e instanceof Error ? e.message : "Erro" };
    }
  });

export const reenviarEnvelopeDocusign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ destinatarioId: z.string().uuid("Destinatário inválido.") })))
  .handler(async ({ data, context }): Promise<{ ok: true; envelopeId: string }> => {
    await assertOperacao(context as unknown as DsCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dest, error: dErr } = await supabaseAdmin
      .from("wa_campanha_destinatarios")
      .select("id, envelope_docusign_id, campanha_id, status")
      .eq("id", data.destinatarioId)
      .maybeSingle();
    if (dErr) throw await erroGenerico("docusign.reenviar", dErr, "Não foi possível ler o destinatário.");
    if (!dest) throw new Error("Destinatário não encontrado");
    if (!dest.envelope_docusign_id) throw new Error("Destinatário não possui envelope para reenviar");
    await assertCampanhaDoUsuario(context as unknown as DsCtx, dest.campanha_id);

    const cfg = await loadConfig();
    if (!cfg?.account_id) throw new Error("DocuSign não configurado.");

    const acc = encodeURIComponent(cfg.account_id);
    const env = encodeURIComponent(dest.envelope_docusign_id);

    // Verifica se o envelope ainda pode ser reenviado.
    const { data: envInfo } = await docusignFetch<{ status?: string }>(
      cfg,
      `/accounts/${acc}/envelopes/${env}`,
    );
    const statusEnv = (envInfo.status ?? "").toLowerCase();
    if (["completed", "signed", "declined", "voided"].includes(statusEnv)) {
      throw new Error(`Envelope está ${statusEnv} e não pode ser reenviado`);
    }

    // Busca recipients atuais para reenviar mantendo o mesmo canal já configurado.
    const { data: recs } = await docusignFetch<{ signers?: any[]; carbonCopies?: any[] }>(
      cfg,
      `/accounts/${acc}/envelopes/${env}/recipients`,
    );
    const signers = (recs.signers ?? []).filter((s: any) => {
      const st = (s.status ?? "").toLowerCase();
      return st !== "completed" && st !== "signed" && st !== "declined";
    });
    if (signers.length === 0) {
      throw new Error("Nenhum destinatário pendente para reenviar");
    }

    await docusignFetch(
      cfg,
      `/accounts/${acc}/envelopes/${env}/recipients?resend_envelope=true`,
      { method: "PUT", body: JSON.stringify({ signers }) },
    );

    await supabaseAdmin
      .from("wa_campanha_destinatarios")
      .update({ enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .eq("id", dest.id);

    return { ok: true, envelopeId: dest.envelope_docusign_id };
  });
