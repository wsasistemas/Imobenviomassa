// Envio de e-mail pelo provedor ativo da imobiliária (só servidor): Resend, SMTP próprio ou Zenvia E-mail.
// Resend conferido na documentação oficial (resend.com/docs/api-reference):
//   · POST /domains { name, region } → { id, status, records[{ record, name, type, ttl, status, value, priority }] }
//   · GET /domains/{id} (status e registros atualizados) · POST /domains/{id}/verify (pede nova verificação)
//   · POST /emails { from, to, subject, html, text, reply_to, attachments[{ filename, content(base64) | path(url) }] } → { id }

import nodemailer from "nodemailer";
import { enviarEmailZenvia } from "./zenvia.server";

const RESEND_API = "https://api.resend.com";
const TEMPO_LIMITE_MS = 20_000;

export type TipoProvedor = "zenvia" | "resend" | "smtp";

export interface RegistroDns {
  record: string | null;
  name: string;
  type: string;
  ttl: string | null;
  status: string | null;
  value: string;
  priority: number | null;
}

export interface ResultadoEnvioEmail {
  ok: boolean;
  id: string | null;
  erro: string | null;
  resposta: unknown;
}

async function resend(
  apiKey: string,
  caminho: string,
  init: { method?: string; body?: unknown } = {},
) {
  let resp: Response;
  try {
    resp = await fetch(`${RESEND_API}${caminho}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch {
    return {
      ok: false,
      status: 0,
      json: null as Record<string, unknown> | null,
      erro: "Não foi possível falar com o Resend.",
    };
  }
  const texto = await resp.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
  } catch {
    /* não-JSON */
  }
  const erro = resp.ok
    ? null
    : resp.status === 401 || resp.status === 403
      ? "O Resend recusou a API key."
      : ((json?.message as string | undefined) ?? `HTTP ${resp.status}`);
  return { ok: resp.ok, status: resp.status, json, erro };
}

function registros(json: Record<string, unknown> | null): RegistroDns[] {
  const lista = Array.isArray(json?.records) ? (json!.records as Record<string, unknown>[]) : [];
  return lista.map((r) => ({
    record: (r.record as string | undefined) ?? null,
    name: String(r.name ?? ""),
    type: String(r.type ?? ""),
    ttl: r.ttl != null ? String(r.ttl) : null,
    status: (r.status as string | undefined) ?? null,
    value: String(r.value ?? ""),
    priority: typeof r.priority === "number" ? r.priority : null,
  }));
}

/** Testa a API key listando os domínios (não envia nada). */
export async function testarResend(apiKey: string): Promise<{ ok: boolean; erro: string | null }> {
  const r = await resend(apiKey, "/domains");
  return { ok: r.ok, erro: r.erro };
}

export async function resendCriarDominio(apiKey: string, dominio: string) {
  const r = await resend(apiKey, "/domains", {
    method: "POST",
    body: { name: dominio, region: "sa-east-1" },
  });
  if (!r.ok) {
    // Domínio já cadastrado na conta: procura o id na lista para seguir com a verificação.
    const lista = await resend(apiKey, "/domains");
    const achado = (
      Array.isArray(lista.json?.data) ? (lista.json!.data as Record<string, unknown>[]) : []
    ).find((d) => String(d.name ?? "").toLowerCase() === dominio);
    if (achado) return resendDominio(apiKey, String(achado.id));
    return { ok: false as const, erro: r.erro ?? "O Resend recusou o domínio." };
  }
  return {
    ok: true as const,
    id: String(r.json?.id ?? ""),
    status: String(r.json?.status ?? "not_started"),
    registros: registros(r.json),
  };
}

export async function resendDominio(apiKey: string, id: string) {
  const r = await resend(apiKey, `/domains/${encodeURIComponent(id)}`);
  if (!r.ok) return { ok: false as const, erro: r.erro ?? "Domínio não encontrado no Resend." };
  return {
    ok: true as const,
    id,
    status: String(r.json?.status ?? "not_started"),
    registros: registros(r.json),
  };
}

export async function resendVerificarDominio(apiKey: string, id: string) {
  const v = await resend(apiKey, `/domains/${encodeURIComponent(id)}/verify`, { method: "POST" });
  if (!v.ok)
    return { ok: false as const, erro: v.erro ?? "O Resend não aceitou o pedido de verificação." };
  return resendDominio(apiKey, id);
}

export interface MensagemEmail {
  from: string; // "Nome <email@dominio>"
  fromEmail: string;
  fromNome: string | null;
  to: string;
  assunto: string;
  html: string;
  texto: string;
  replyTo?: string | null;
  anexo?: { nome: string; conteudo: Uint8Array; url: string } | null;
}

export async function enviarEmail(
  provedor: {
    tipo: TipoProvedor;
    smtp_host?: string | null;
    smtp_porta?: number | null;
    smtp_usuario?: string | null;
    smtp_seguro?: boolean;
  },
  credencial: string,
  msg: MensagemEmail,
): Promise<ResultadoEnvioEmail> {
  if (provedor.tipo === "resend") {
    const corpo: Record<string, unknown> = {
      from: msg.from,
      to: [msg.to],
      subject: msg.assunto,
      html: msg.html,
      text: msg.texto,
    };
    if (msg.replyTo) corpo.reply_to = msg.replyTo;
    if (msg.anexo)
      corpo.attachments = [
        { filename: msg.anexo.nome, content: Buffer.from(msg.anexo.conteudo).toString("base64") },
      ];
    const r = await resend(credencial, "/emails", { method: "POST", body: corpo });
    return {
      ok: r.ok,
      id: (r.json?.id as string | undefined) ?? null,
      erro: r.erro,
      resposta: r.json,
    };
  }

  if (provedor.tipo === "smtp") {
    if (!provedor.smtp_host || !provedor.smtp_porta)
      return { ok: false, id: null, erro: "SMTP sem host ou porta.", resposta: null };
    try {
      const transporte = nodemailer.createTransport({
        host: provedor.smtp_host,
        port: provedor.smtp_porta,
        secure: provedor.smtp_seguro ?? provedor.smtp_porta === 465,
        auth: provedor.smtp_usuario ? { user: provedor.smtp_usuario, pass: credencial } : undefined,
        connectionTimeout: TEMPO_LIMITE_MS,
        greetingTimeout: TEMPO_LIMITE_MS,
      });
      const info = await transporte.sendMail({
        from: msg.from,
        to: msg.to,
        subject: msg.assunto,
        html: msg.html,
        text: msg.texto,
        replyTo: msg.replyTo ?? undefined,
        attachments: msg.anexo
          ? [
              {
                filename: msg.anexo.nome,
                content: Buffer.from(msg.anexo.conteudo),
                contentType: "application/pdf",
              },
            ]
          : undefined,
      });
      return {
        ok: true,
        id: info.messageId ?? null,
        erro: null,
        resposta: { accepted: info.accepted, rejected: info.rejected, response: info.response },
      };
    } catch (e) {
      return {
        ok: false,
        id: null,
        erro: e instanceof Error ? `SMTP: ${e.message.slice(0, 200)}` : "Falha no SMTP.",
        resposta: null,
      };
    }
  }

  // Zenvia E-mail: o anexo vai por URL (a Zenvia baixa o arquivo).
  const r = await enviarEmailZenvia(credencial, {
    from: msg.fromEmail,
    to: msg.to,
    assunto: msg.assunto,
    html: msg.html,
    anexos: msg.anexo ? [{ url: msg.anexo.url, nome: msg.anexo.nome }] : undefined,
    replyTo: msg.replyTo,
  });
  return { ok: r.ok, id: r.id, erro: r.erro, resposta: r.resposta };
}

/** Testa o login no SMTP sem enviar nada. */
export async function testarSmtp(
  p: { smtp_host: string; smtp_porta: number; smtp_usuario: string | null; smtp_seguro: boolean },
  senha: string,
): Promise<{ ok: boolean; erro: string | null }> {
  try {
    const t = nodemailer.createTransport({
      host: p.smtp_host,
      port: p.smtp_porta,
      secure: p.smtp_seguro,
      auth: p.smtp_usuario ? { user: p.smtp_usuario, pass: senha } : undefined,
      connectionTimeout: TEMPO_LIMITE_MS,
    });
    await t.verify();
    return { ok: true, erro: null };
  } catch (e) {
    return {
      ok: false,
      erro: e instanceof Error ? `SMTP: ${e.message.slice(0, 200)}` : "Falha no SMTP.",
    };
  }
}
