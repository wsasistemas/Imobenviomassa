// Cliente da Zenvia (API v2) — só servidor. Adaptado do Vs_Portal_Atendimento (_shared/atendimento/zenvia.ts),
// que já roda em produção. Campos conferidos na especificação oficial (github.com/zenvia/zenvia-openapi-spec):
//   · envio por template: contents[{ type: "template", templateId, fields }], e o arquivo do cabeçalho de mídia
//     vai em fields.documentUrl (imageUrl / videoUrl para outros tipos);
//   · templates: GET /v2/templates → id, name, locale, channel, senderId, category, status, text, fields[],
//     components.header.type (MEDIA_DOCUMENT, MEDIA_IMAGE, …);
//   · e-mail: POST /v2/channels/email/messages, contents[{ type: "email", subject, html, attachments[{ fileUrl, fileName }] }].
//
// Armadilha conhecida (Cerebro: zenvia-aceita-envio-de-outra-conta-e-descarta-depois): a Zenvia responde 200 com id
// mesmo quando o remetente ou o template são de OUTRA conta e descarta depois; o motivo só chega pelo webhook
// MESSAGE_STATUS. Por isso o teste confere os números contra os senderId dos templates e a régua exige a assinatura.

export const ZENVIA_API = "https://api.zenvia.com/v2";
const TEMPO_LIMITE_MS = 20_000;

export interface ResultadoZenvia {
  ok: boolean;
  status: number;
  id: string | null;
  erro: string | null;
  resposta: unknown;
}

async function chamar(
  token: string,
  caminho: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ResultadoZenvia> {
  let resp: Response;
  try {
    resp = await fetch(`${ZENVIA_API}${caminho}`, {
      method: init.method ?? "GET",
      headers: {
        "X-API-TOKEN": token,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (e) {
    const tempo = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return {
      ok: false,
      status: 0,
      id: null,
      erro: tempo ? "A Zenvia não respondeu a tempo." : "Não foi possível falar com a Zenvia.",
      resposta: null,
    };
  }
  const texto = await resp.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* resposta não-JSON */
  }
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const erroApi = (o.error ?? null) as { description?: string } | null;
  const ok = resp.ok && !erroApi;
  let erro: string | null = null;
  if (!ok) {
    if (resp.status === 401 || resp.status === 403)
      erro = "A Zenvia recusou o token (HTTP " + resp.status + ").";
    else erro = erroApi?.description ?? (o.message as string | undefined) ?? `HTTP ${resp.status}`;
  }
  return {
    ok,
    status: resp.status,
    id: (o.id as string | undefined) ?? null,
    erro,
    resposta: json ?? texto.slice(0, 2000),
  };
}

// ---------------------------------------------------------------- templates

export interface TemplateZenvia {
  id: string;
  nome: string;
  canal: string | null;
  idioma: string | null;
  categoria: string | null;
  status: string;
  senderId: string | null;
  headerTipo: string | null;
  texto: string | null;
  variaveis: string[];
}

function variaveisDoTexto(texto: string | null): string[] {
  const out = new Set<string>();
  for (const m of (texto ?? "").matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) out.add(m[1]);
  return [...out];
}

export async function listarTemplates(
  token: string,
): Promise<{ ok: true; templates: TemplateZenvia[] } | { ok: false; erro: string }> {
  const r = await chamar(token, "/templates");
  if (!r.ok) return { ok: false, erro: r.erro ?? "Falha ao listar templates." };
  const bruto = r.resposta;
  const lista = (
    Array.isArray(bruto)
      ? bruto
      : Array.isArray((bruto as { data?: unknown[] })?.data)
        ? (bruto as { data: unknown[] }).data
        : []
  ) as Record<string, unknown>[];
  return {
    ok: true,
    templates: lista.map((t) => {
      const comps = (t.components ?? {}) as {
        header?: { type?: string };
        body?: { text?: string };
      };
      const texto = (t.text as string | undefined) ?? comps.body?.text ?? null;
      const campos = Array.isArray(t.fields) ? (t.fields as unknown[]).map(String) : [];
      return {
        id: String(t.id ?? ""),
        nome: String(t.name ?? t.id ?? ""),
        canal: (t.channel as string | undefined) ?? null,
        idioma: (t.locale as string | undefined) ?? null,
        categoria: (t.category as string | undefined) ?? null,
        status: String(t.status ?? "").toUpperCase(),
        senderId: (t.senderId as string | undefined) ?? null,
        headerTipo: comps.header?.type ?? null,
        texto,
        // `fields` vem da Zenvia; se faltar, sai do texto. Campos de mídia (documentUrl…) não são variáveis da régua.
        variaveis: (campos.length ? campos : variaveisDoTexto(texto)).filter(
          (v) => !/^(documentUrl|imageUrl|videoUrl)$/i.test(v),
        ),
      };
    }),
  };
}

/** Números (senderId) que aparecem nos templates de WhatsApp da conta do token. */
export function numerosDaConta(templates: TemplateZenvia[]): string[] {
  const s = new Set<string>();
  for (const t of templates) {
    if ((t.canal ?? "WHATSAPP").toUpperCase() !== "WHATSAPP") continue;
    const n = (t.senderId ?? "").replace(/\D/g, "");
    if (n) s.add(n);
  }
  return [...s];
}

// ---------------------------------------------------------------- envio

export function enviarTemplateWhatsapp(
  token: string,
  msg: {
    from: string;
    to: string;
    templateId: string;
    fields: Record<string, string>;
    documentoUrl?: string | null;
  },
): Promise<ResultadoZenvia> {
  const fields: Record<string, string> = { ...msg.fields };
  if (msg.documentoUrl) fields.documentUrl = msg.documentoUrl;
  return chamar(token, "/channels/whatsapp/messages", {
    method: "POST",
    body: {
      from: msg.from,
      to: msg.to,
      contents: [{ type: "template", templateId: msg.templateId, fields }],
    },
  });
}

export function enviarTextoWhatsapp(
  token: string,
  from: string,
  to: string,
  texto: string,
): Promise<ResultadoZenvia> {
  return chamar(token, "/channels/whatsapp/messages", {
    method: "POST",
    body: { from, to, contents: [{ type: "text", text: texto }] },
  });
}

export function enviarEmailZenvia(
  token: string,
  msg: {
    from: string;
    to: string;
    assunto: string;
    html: string;
    anexos?: { url: string; nome: string }[];
    replyTo?: string | null;
  },
): Promise<ResultadoZenvia> {
  const content: Record<string, unknown> = { type: "email", subject: msg.assunto, html: msg.html };
  if (msg.anexos?.length)
    content.attachments = msg.anexos.map((a) => ({ fileUrl: a.url, fileName: a.nome }));
  if (msg.replyTo) content.replyTo = { email: msg.replyTo };
  return chamar(token, "/channels/email/messages", {
    method: "POST",
    body: { from: msg.from, to: msg.to, contents: [content] },
  });
}

// ---------------------------------------------------------------- assinaturas (webhook)

export interface AssinaturaZenvia {
  id: string;
  eventType: string;
  url: string | null;
  status: string | null;
}

export async function listarAssinaturas(token: string): Promise<AssinaturaZenvia[]> {
  const r = await chamar(token, "/subscriptions");
  if (!r.ok || !Array.isArray(r.resposta)) return [];
  return (r.resposta as Record<string, unknown>[]).map((s) => ({
    id: String(s.id ?? ""),
    eventType: String(s.eventType ?? ""),
    url: ((s.webhook as { url?: string } | undefined)?.url as string | undefined) ?? null,
    status: (s.status as string | undefined) ?? null,
  }));
}

export async function criarAssinatura(
  token: string,
  eventType: "MESSAGE" | "MESSAGE_STATUS",
  url: string,
  chave: string,
): Promise<ResultadoZenvia> {
  return chamar(token, "/subscriptions", {
    method: "POST",
    body: {
      eventType,
      webhook: { url, headers: { "x-imobenviomassa-chave": chave } },
      criteria: { channel: "whatsapp" },
    },
  });
}

export async function removerAssinatura(token: string, id: string): Promise<void> {
  await chamar(token, `/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}
