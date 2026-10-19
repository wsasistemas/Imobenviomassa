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

// Integrações › Zenvia WhatsApp (PRD 5.2). Admin consulta, testa, cria assinaturas, sincroniza templates e ajusta
// os números; só Super Admin troca o token (mesma regra das outras credenciais). O token fica no Vault.
// Os módulos *.server.ts entram com import dinâmico: este arquivo também vai para o bundle do navegador.

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

const ctx = (c: unknown) => c as ContextoAutenticado;
const MSG_ADMIN = "Só Admin e Super Admin usam as integrações.";
const WEBHOOK_FN = "imobenviomassa-zenvia-webhook";

export interface RemetenteZenvia {
  id: string;
  numero: string;
  nome: string | null;
  setor: string | null;
  status: "ativo" | "inativo";
  naConta: boolean;
  padraoRegua: boolean;
}

export interface TemplateWhatsapp {
  id: string;
  zenviaId: string;
  nome: string;
  categoria: string | null;
  idioma: string | null;
  status: string;
  headerTipo: string | null;
  corpo: string | null;
  variaveis: string[];
  senderId: string | null;
  sincronizadoEm: string;
  uso: string[];
}

export interface StatusZenvia {
  configurado: boolean;
  statusConexao: "nao_configurado" | "conectado" | "erro";
  testadoEm: string | null;
  resumo: { numeros?: number; templates?: number; erro?: string | null };
  webhook: { url: string; assinaturas: { evento: string; id: string }[] };
  remetentes: RemetenteZenvia[];
  templates: TemplateWhatsapp[];
  podeTrocarToken: boolean;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}

function urlWebhook(imob: string): string {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/${WEBHOOK_FN}?imob=${imob}`;
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

async function tokenObrigatorio(imob: string): Promise<string> {
  const { lerSegredo } = await import("./segredos.server");
  const token = await lerSegredo("zenvia_token", imob);
  if (!token) throw new Error("Cadastre o token da Zenvia antes (Conta › Substituir).");
  return token;
}

async function carregarStatus(imob: string, podeTrocarToken: boolean): Promise<StatusZenvia> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { existeSegredo } = await import("./segredos.server");
  const [cfg, rem, tpl, uso, configurado] = await Promise.all([
    supabaseAdmin.from("integracao_zenvia").select("*").eq("imobiliaria_id", imob).maybeSingle(),
    supabaseAdmin.from("whatsapp_remetente").select("*").eq("imobiliaria_id", imob).order("numero"),
    supabaseAdmin.from("whatsapp_template").select("*").eq("imobiliaria_id", imob).order("nome"),
    supabaseAdmin
      .from("regua_template")
      .select("nome, whatsapp_template_id")
      .eq("imobiliaria_id", imob)
      .eq("canal", "whatsapp"),
    existeSegredo("zenvia_token", imob),
  ]);
  const usoPor = new Map<string, string[]>();
  for (const u of uso.data ?? []) {
    if (!u.whatsapp_template_id) continue;
    usoPor.set(u.whatsapp_template_id, [...(usoPor.get(u.whatsapp_template_id) ?? []), u.nome]);
  }
  const ids = (cfg.data?.webhook_ids ?? {}) as Record<string, string>;
  return {
    configurado,
    statusConexao: configurado
      ? ((cfg.data?.status_conexao as StatusZenvia["statusConexao"]) ?? "nao_configurado")
      : "nao_configurado",
    testadoEm: cfg.data?.testado_em ?? null,
    resumo: (cfg.data?.teste_resumo ?? {}) as StatusZenvia["resumo"],
    webhook: {
      url: urlWebhook(imob),
      assinaturas: Object.entries(ids).map(([evento, id]) => ({ evento, id })),
    },
    remetentes: (rem.data ?? []).map((r) => ({
      id: r.id,
      numero: r.numero,
      nome: r.nome,
      setor: r.setor,
      status: r.status as "ativo" | "inativo",
      naConta: r.na_conta,
      padraoRegua: r.padrao_regua,
    })),
    templates: (tpl.data ?? []).map((t) => ({
      id: t.id,
      zenviaId: t.zenvia_id,
      nome: t.nome,
      categoria: t.categoria,
      idioma: t.idioma,
      status: t.status,
      headerTipo: t.header_tipo,
      corpo: t.corpo,
      variaveis: Array.isArray(t.variaveis) ? (t.variaveis as string[]) : [],
      senderId: t.sender_id,
      sincronizadoEm: t.sincronizado_em,
      uso: usoPor.get(t.id) ?? [],
    })),
    podeTrocarToken,
    atualizadoEm: cfg.data?.atualizado_em ?? null,
    atualizadoPor: cfg.data?.atualizado_por ?? null,
  };
}

export const statusZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatusZenvia> => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    return carregarStatus(imob, await temPapel(ctx(context), ["super_admin"]));
  });

export const salvarTokenZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        token: z
          .string({ required_error: "Cole o token." })
          .trim()
          .min(20, "Token muito curto.")
          .max(300, "Token muito longo.")
          .regex(/^\S+$/, "O token não pode ter espaços."),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirSuperAdmin(ctx(context), "Só o Super Admin troca o token da Zenvia.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const { gravarSegredo, existeSegredo } = await import("./segredos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { listarTemplates } = await import("./zenvia.server");

    // Confere o token antes de gravar (um token inválido não substitui o atual).
    const t = await listarTemplates(data.token);
    if (!t.ok) throw new Error(`A Zenvia não aceitou o token: ${t.erro}`);

    await gravarSegredo("zenvia_token", imob, data.token);
    if (!(await existeSegredo("zenvia_webhook", imob))) {
      const { randomBytes } = await import("node:crypto");
      await gravarSegredo("zenvia_webhook", imob, randomBytes(32).toString("hex"));
    }
    const quem = await autor(ctx(context));
    await supabaseAdmin.from("integracao_zenvia").upsert({
      imobiliaria_id: imob,
      status_conexao: "conectado",
      atualizado_por: quem,
      testado_em: new Date().toISOString(),
    });
    await auditar({
      userId: ctx(context).userId,
      acao: "zenvia_token_salvo",
      entidade: "integracao_zenvia",
      entidadeId: imob,
      detalhes: { templates: t.templates.length },
    });
    return { ok: true };
  });

/** Testa o token e confere os números: cada número precisa aparecer como senderId nos templates da conta. */
export const testarZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const token = await tokenObrigatorio(imob);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listarTemplates, numerosDaConta } = await import("./zenvia.server");
    const { auditar } = await import("@/lib/auditoria.server");

    const t = await listarTemplates(token);
    const agora = new Date().toISOString();
    if (!t.ok) {
      await supabaseAdmin.from("integracao_zenvia").upsert({
        imobiliaria_id: imob,
        status_conexao: "erro",
        testado_em: agora,
        teste_resumo: { erro: t.erro },
      });
      return { ok: false, erro: t.erro };
    }
    const numeros = numerosDaConta(t.templates);
    // Números novos entram; os que sumiram da conta ficam marcados como fora da conta (não são apagados).
    if (numeros.length) {
      await supabaseAdmin.from("whatsapp_remetente").upsert(
        numeros.map((numero) => ({ imobiliaria_id: imob, numero, na_conta: true })),
        { onConflict: "imobiliaria_id,numero" },
      );
    }
    const { data: todos } = await supabaseAdmin
      .from("whatsapp_remetente")
      .select("id, numero")
      .eq("imobiliaria_id", imob);
    const fora = (todos ?? []).filter((r) => !numeros.includes(r.numero)).map((r) => r.id);
    if (fora.length)
      await supabaseAdmin.from("whatsapp_remetente").update({ na_conta: false }).in("id", fora);

    const resumo = {
      numeros: numeros.length,
      templates: t.templates.filter((x) => (x.canal ?? "WHATSAPP").toUpperCase() === "WHATSAPP")
        .length,
      erro: null,
    };
    await supabaseAdmin.from("integracao_zenvia").upsert({
      imobiliaria_id: imob,
      status_conexao: "conectado",
      testado_em: agora,
      teste_resumo: resumo,
    });
    await auditar({
      userId: ctx(context).userId,
      acao: "zenvia_testada",
      entidade: "integracao_zenvia",
      entidadeId: imob,
      detalhes: resumo,
    });
    return { ok: true, ...resumo };
  });

/** Uma assinatura para mensagens e uma para status de entrega, apontando para a Edge Function do webhook. */
export const criarAssinaturasZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const token = await tokenObrigatorio(imob);
    const { lerSegredo, gravarSegredo } = await import("./segredos.server");
    const { listarAssinaturas, criarAssinatura, removerAssinatura } =
      await import("./zenvia.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL não configurada no servidor.");

    let chave = await lerSegredo("zenvia_webhook", imob);
    if (!chave) {
      const { randomBytes } = await import("node:crypto");
      chave = randomBytes(32).toString("hex");
      await gravarSegredo("zenvia_webhook", imob, chave);
    }
    const url = urlWebhook(imob);
    const existentes = await listarAssinaturas(token);
    const ids: Record<string, string> = {};
    for (const evento of ["MESSAGE", "MESSAGE_STATUS"] as const) {
      // Recria a deste endereço (a chave no cabeçalho pode ter mudado).
      for (const s of existentes.filter((x) => x.eventType === evento && x.url === url))
        await removerAssinatura(token, s.id);
      const r = await criarAssinatura(token, evento, url, chave);
      if (!r.ok || !r.id)
        throw new Error(`A Zenvia recusou a assinatura ${evento}: ${r.erro ?? "sem id"}`);
      ids[evento] = r.id;
    }
    await supabaseAdmin
      .from("integracao_zenvia")
      .upsert({ imobiliaria_id: imob, webhook_ids: ids });
    await auditar({
      userId: ctx(context).userId,
      acao: "zenvia_assinaturas_criadas",
      entidade: "integracao_zenvia",
      entidadeId: imob,
      detalhes: { ids },
    });
    return { ok: true, ids };
  });

export const sincronizarTemplatesZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const token = await tokenObrigatorio(imob);
    const { listarTemplates } = await import("./zenvia.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");

    const t = await listarTemplates(token);
    if (!t.ok) throw new Error(`Não foi possível ler os templates: ${t.erro}`);
    const whats = t.templates.filter(
      (x) => (x.canal ?? "WHATSAPP").toUpperCase() === "WHATSAPP" && x.id,
    );
    const agora = new Date().toISOString();
    if (whats.length) {
      const { error } = await supabaseAdmin.from("whatsapp_template").upsert(
        whats.map((x) => ({
          imobiliaria_id: imob,
          zenvia_id: x.id,
          nome: x.nome,
          categoria: x.categoria,
          idioma: x.idioma,
          status: x.status || "DESCONHECIDO",
          header_tipo: x.headerTipo,
          corpo: x.texto,
          variaveis: x.variaveis,
          sender_id: x.senderId ? x.senderId.replace(/\D/g, "") || x.senderId : null,
          sincronizado_em: agora,
        })),
        { onConflict: "imobiliaria_id,zenvia_id" },
      );
      if (error) {
        const { erroGenerico } = await import("@/lib/erros.server");
        throw erroGenerico("zenvia.sincronizar", error, "Não foi possível gravar os templates.");
      }
    }
    // Template apagado na Zenvia: fica com status REMOVIDO (pode estar vinculado na biblioteca da régua).
    const vivos = new Set(whats.map((x) => x.id));
    const { data: locais } = await supabaseAdmin
      .from("whatsapp_template")
      .select("id, zenvia_id")
      .eq("imobiliaria_id", imob);
    const sumiram = (locais ?? []).filter((l) => !vivos.has(l.zenvia_id)).map((l) => l.id);
    if (sumiram.length)
      await supabaseAdmin
        .from("whatsapp_template")
        .update({ status: "REMOVIDO" })
        .in("id", sumiram);

    await auditar({
      userId: ctx(context).userId,
      acao: "zenvia_templates_sincronizados",
      entidade: "whatsapp_template",
      detalhes: { total: whats.length, removidos: sumiram.length },
    });
    return { ok: true, total: whats.length, removidos: sumiram.length };
  });

export const salvarRemetenteZenvia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        id: z.string().uuid("Número inválido."),
        nome: z.string().trim().max(80, "Nome muito longo.").nullable().optional(),
        setor: z.string().trim().max(60, "Setor muito longo.").nullable().optional(),
        status: z.enum(["ativo", "inativo"]).optional(),
        padraoRegua: z.boolean().optional(),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirPapel(ctx(context), ["admin", "super_admin"], MSG_ADMIN);
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { data: antes } = await supabaseAdmin
      .from("whatsapp_remetente")
      .select("*")
      .eq("id", data.id)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!antes) throw new Error("Número não encontrado.");
    if (data.padraoRegua) {
      if ((data.status ?? antes.status) !== "ativo")
        throw new Error("Só um número ativo pode ser o padrão da régua.");
      await supabaseAdmin
        .from("whatsapp_remetente")
        .update({ padrao_regua: false })
        .eq("imobiliaria_id", imob)
        .neq("id", data.id);
    }
    const mudar: {
      nome?: string | null;
      setor?: string | null;
      status?: "ativo" | "inativo";
      padrao_regua?: boolean;
    } = {};
    if (data.nome !== undefined) mudar.nome = data.nome || null;
    if (data.setor !== undefined) mudar.setor = data.setor || null;
    if (data.status !== undefined) mudar.status = data.status;
    if (data.padraoRegua !== undefined) mudar.padrao_regua = data.padraoRegua;
    if (data.status === "inativo") mudar.padrao_regua = false;
    const { error } = await supabaseAdmin
      .from("whatsapp_remetente")
      .update(mudar)
      .eq("id", data.id)
      .eq("imobiliaria_id", imob);
    if (error) throw new Error("Não foi possível salvar o número.");
    await auditar({
      userId: ctx(context).userId,
      acao: "zenvia_remetente_alterado",
      entidade: "whatsapp_remetente",
      entidadeId: data.id,
      detalhes: {
        antes: {
          nome: antes.nome,
          setor: antes.setor,
          status: antes.status,
          padrao: antes.padrao_regua,
        },
        depois: mudar,
      },
    });
    return { ok: true };
  });
