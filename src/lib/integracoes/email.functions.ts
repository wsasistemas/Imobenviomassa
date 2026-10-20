import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  exigirPapel,
  exigirSuperAdmin,
  imobiliariaDoContexto,
  temPapel,
  type ContextoAutenticado,
} from "@/lib/authz";

// Integrações › E-mail (PRD 5.2): um provedor ativo por imobiliária — Zenvia E-mail (token da Zenvia), Resend
// (API key no Vault, domínio do cliente cadastrado e verificado pela API) ou SMTP próprio (senha no Vault).
// Sem domínio `verified`, a régua não envia e-mail pelo Resend.

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

const ctx = (c: unknown) => c as ContextoAutenticado;
const MSG_ADMIN = "Só Admin e Super Admin usam as integrações.";

export type TipoProvedorEmail = "zenvia" | "resend" | "smtp";

export interface StatusEmail {
  tipo: TipoProvedorEmail;
  ativo: boolean;
  credencialConfigurada: boolean;
  credencialTestadaEm: string | null;
  smtp: { host: string | null; porta: number | null; usuario: string | null; seguro: boolean };
  dominio: string | null;
  dominioId: string | null;
  statusDominio: string | null;
  registrosDns: {
    record: string | null;
    name: string;
    type: string;
    ttl: string | null;
    status: string | null;
    value: string;
    priority: number | null;
  }[];
  dominioVerificadoEm: string | null;
  remetente: { nome: string | null; email: string | null; replyTo: string | null };
  podeTrocarCredencial: boolean;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}

async function autor(context: ContextoAutenticado): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("nome, email")
    .eq("id", context.userId)
    .maybeSingle();
  return data?.nome || data?.email || "—";
}

async function linha(imob: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("email_provedor")
    .select("*")
    .eq("imobiliaria_id", imob)
    .maybeSingle();
  if (data) return data;
  await supabaseAdmin.from("email_provedor").upsert({ imobiliaria_id: imob });
  const r = await supabaseAdmin
    .from("email_provedor")
    .select("*")
    .eq("imobiliaria_id", imob)
    .single();
  return r.data!;
}

const segredoDo = (tipo: TipoProvedorEmail) =>
  (tipo === "resend" ? "resend_apikey" : tipo === "smtp" ? "smtp_senha" : "zenvia_token") as
    "resend_apikey" | "smtp_senha" | "zenvia_token";

export const statusEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusEmail> => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { existeSegredo } = await import("./segredos.server");
    const p = await linha(imob);
    const tipo = p.tipo as TipoProvedorEmail;
    return {
      tipo,
      ativo: p.ativo,
      credencialConfigurada: await existeSegredo(segredoDo(tipo), imob),
      credencialTestadaEm: p.credencial_testada_em,
      smtp: {
        host: p.smtp_host,
        porta: p.smtp_porta,
        usuario: p.smtp_usuario,
        seguro: p.smtp_seguro,
      },
      dominio: p.dominio,
      dominioId: p.dominio_id_provedor,
      statusDominio: p.status_dominio,
      registrosDns: Array.isArray(p.registros_dns)
        ? (p.registros_dns as StatusEmail["registrosDns"])
        : [],
      dominioVerificadoEm: p.dominio_verificado_em,
      remetente: { nome: p.remetente_nome, email: p.remetente_email, replyTo: p.reply_to },
      podeTrocarCredencial: await temPapel(ctx(context), ["super_admin"]),
      atualizadoEm: p.atualizado_em,
      atualizadoPor: p.atualizado_por,
    };
  });

const emailOpc = z
  .string()
  .trim()
  .max(254)
  .email("E-mail inválido.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

/** Provedor, ativo, SMTP (sem senha) e remetente. Não mexe em credencial. */
export const salvarConfigEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        tipo: z.enum(["zenvia", "resend", "smtp"]),
        ativo: z.boolean(),
        smtpHost: z
          .string()
          .trim()
          .max(200)
          .regex(/^[a-z0-9.-]*$/i, "Host SMTP inválido.")
          .nullable()
          .optional(),
        smtpPorta: z.number().int().min(1).max(65535).nullable().optional(),
        smtpUsuario: z.string().trim().max(200).nullable().optional(),
        smtpSeguro: z.boolean().optional(),
        remetenteNome: z.string().trim().max(80, "Nome muito longo.").nullable().optional(),
        remetenteEmail: emailOpc,
        replyTo: emailOpc,
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const antes = await linha(imob);

    // Ativar o Resend com domínio ainda não verificado é permitido: a régua bloqueia o envio até ficar `verified`.
    if (
      data.remetenteEmail &&
      data.tipo === "resend" &&
      antes.dominio &&
      !data.remetenteEmail.toLowerCase().endsWith("@" + antes.dominio)
    ) {
      throw new Error(`O e-mail do remetente precisa ser do domínio ${antes.dominio}.`);
    }
    if (data.tipo === "smtp" && data.ativo && (!data.smtpHost || !data.smtpPorta))
      throw new Error("Informe host e porta do SMTP.");

    const depois = {
      tipo: data.tipo,
      ativo: data.ativo,
      smtp_host: data.smtpHost ?? null,
      smtp_porta: data.smtpPorta ?? null,
      smtp_usuario: data.smtpUsuario ?? null,
      smtp_seguro: data.smtpSeguro ?? true,
      remetente_nome: data.remetenteNome ?? null,
      remetente_email: data.remetenteEmail ?? null,
      reply_to: data.replyTo ?? null,
      atualizado_por: await autor(ctx(context)),
    };
    const { error } = await supabaseAdmin
      .from("email_provedor")
      .update(depois)
      .eq("imobiliaria_id", imob);
    if (error) throw new Error("Não foi possível salvar a configuração de e-mail.");
    await auditar({
      userId: ctx(context).userId,
      acao: "email_config_salva",
      entidade: "email_provedor",
      entidadeId: imob,
      detalhes: {
        antes: {
          tipo: antes.tipo,
          ativo: antes.ativo,
          smtp_host: antes.smtp_host,
          remetente: antes.remetente_email,
        },
        depois: {
          tipo: depois.tipo,
          ativo: depois.ativo,
          smtp_host: depois.smtp_host,
          remetente: depois.remetente_email,
        },
      },
    });
    return { ok: true };
  });

/** API key do Resend ou senha do SMTP (Zenvia E-mail usa o token da aba Zenvia). Só Super Admin. */
export const salvarCredencialEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        tipo: z.enum(["resend", "smtp"]),
        valor: z.string().min(4, "Credencial muito curta.").max(400, "Credencial muito longa."),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirSuperAdmin(ctx(context), "Só o Super Admin troca as credenciais de e-mail.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const { gravarSegredo } = await import("./segredos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const email = await import("./email.server");

    if (data.tipo === "resend") {
      const t = await email.testarResend(data.valor.trim());
      if (!t.ok) throw new Error(`O Resend não aceitou a API key: ${t.erro}`);
      await gravarSegredo("resend_apikey", imob, data.valor.trim());
    } else {
      const p = await linha(imob);
      if (p.smtp_host && p.smtp_porta) {
        const t = await email.testarSmtp(
          {
            smtp_host: p.smtp_host,
            smtp_porta: p.smtp_porta,
            smtp_usuario: p.smtp_usuario,
            smtp_seguro: p.smtp_seguro,
          },
          data.valor,
        );
        if (!t.ok) throw new Error(`O servidor SMTP recusou o login: ${t.erro}`);
      }
      await gravarSegredo("smtp_senha", imob, data.valor);
    }
    await supabaseAdmin
      .from("email_provedor")
      .update({
        credencial_testada_em: new Date().toISOString(),
        atualizado_por: await autor(ctx(context)),
      })
      .eq("imobiliaria_id", imob);
    await auditar({
      userId: ctx(context).userId,
      acao: "email_credencial_salva",
      entidade: "email_provedor",
      entidadeId: imob,
      detalhes: { tipo: data.tipo },
    });
    return { ok: true };
  });

export const testarCredencialEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { lerSegredo } = await import("./segredos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = await import("./email.server");
    const p = await linha(imob);
    const tipo = p.tipo as TipoProvedorEmail;
    const cred = await lerSegredo(segredoDo(tipo), imob);
    if (!cred)
      return {
        ok: false,
        erro:
          tipo === "zenvia"
            ? "Cadastre o token na aba Zenvia WhatsApp."
            : "Credencial não cadastrada.",
      };
    let r: { ok: boolean; erro: string | null };
    if (tipo === "resend") r = await email.testarResend(cred);
    else if (tipo === "smtp") {
      if (!p.smtp_host || !p.smtp_porta)
        return { ok: false, erro: "Informe host e porta do SMTP." };
      r = await email.testarSmtp(
        {
          smtp_host: p.smtp_host,
          smtp_porta: p.smtp_porta,
          smtp_usuario: p.smtp_usuario,
          smtp_seguro: p.smtp_seguro,
        },
        cred,
      );
    } else {
      const { listarTemplates } = await import("./zenvia.server");
      const t = await listarTemplates(cred);
      r = { ok: t.ok, erro: t.ok ? null : t.erro };
    }
    if (r.ok)
      await supabaseAdmin
        .from("email_provedor")
        .update({ credencial_testada_em: new Date().toISOString() })
        .eq("imobiliaria_id", imob);
    return r;
  });

const dominioSchema = z
  .string({ required_error: "Informe o domínio." })
  .trim()
  .toLowerCase()
  .max(200)
  .regex(
    /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/,
    "Domínio inválido (ex.: imobsystems.com.br).",
  );

export const cadastrarDominioResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ dominio: dominioSchema })))
  .handler(async ({ data, context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { lerSegredo } = await import("./segredos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { resendCriarDominio } = await import("./email.server");
    const chave = await lerSegredo("resend_apikey", imob);
    if (!chave) throw new Error("Cadastre a API key do Resend antes.");
    const r = await resendCriarDominio(chave, data.dominio);
    if (!r.ok) throw new Error(r.erro);
    await supabaseAdmin
      .from("email_provedor")
      .update({
        dominio: data.dominio,
        dominio_id_provedor: r.id,
        status_dominio: r.status as never,
        registros_dns: r.registros as never,
        dominio_verificado_em: null,
      })
      .eq("imobiliaria_id", imob);
    await auditar({
      userId: ctx(context).userId,
      acao: "email_dominio_cadastrado",
      entidade: "email_provedor",
      entidadeId: imob,
      detalhes: { dominio: data.dominio, status: r.status },
    });
    return { ok: true, status: r.status };
  });

export const verificarDominioResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { lerSegredo } = await import("./segredos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { resendVerificarDominio } = await import("./email.server");
    const p = await linha(imob);
    if (!p.dominio_id_provedor) throw new Error("Cadastre o domínio antes.");
    const chave = await lerSegredo("resend_apikey", imob);
    if (!chave) throw new Error("Cadastre a API key do Resend antes.");
    const r = await resendVerificarDominio(chave, p.dominio_id_provedor);
    if (!r.ok) throw new Error(r.erro);
    await supabaseAdmin
      .from("email_provedor")
      .update({
        status_dominio: r.status as never,
        registros_dns: r.registros as never,
        dominio_verificado_em: r.status === "verified" ? new Date().toISOString() : null,
      })
      .eq("imobiliaria_id", imob);
    await auditar({
      userId: ctx(context).userId,
      acao: "email_dominio_verificado",
      entidade: "email_provedor",
      entidadeId: imob,
      detalhes: { dominio: p.dominio, status: r.status },
    });
    return {
      ok: true,
      status: r.status,
      pediuVerificacao: "pediuVerificacao" in r ? r.pediuVerificacao : false,
    };
  });

export const enviarEmailTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ para: z.string().trim().email("E-mail inválido.").max(254) })))
  .handler(async ({ data, context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { remetenteEmailPronto } = await import("@/lib/regua/envio.server");
    const { enviarEmail } = await import("./email.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const pronto = await remetenteEmailPronto(imob, { exigirAtivo: false });
    const r = await enviarEmail(pronto.provedor, pronto.credencial, {
      from: pronto.from,
      fromEmail: pronto.fromEmail,
      fromNome: pronto.fromNome,
      to: data.para,
      assunto: "Teste de e-mail · Disparo de Cobranças e Documentos",
      html: "<p>Este é um e-mail de teste do <b>Disparo de Cobranças e Documentos</b>. Se chegou, o provedor está configurado.</p>",
      texto:
        "Este é um e-mail de teste do Disparo de Cobranças e Documentos. Se chegou, o provedor está configurado.",
      replyTo: pronto.replyTo,
    });
    await auditar({
      userId: ctx(context).userId,
      acao: "email_teste_enviado",
      entidade: "email_provedor",
      entidadeId: imob,
      detalhes: { provedor: pronto.provedor.tipo, ok: r.ok },
    });
    if (!r.ok) throw new Error(r.erro ?? "O provedor recusou o envio.");
    return { ok: true, id: r.id };
  });
