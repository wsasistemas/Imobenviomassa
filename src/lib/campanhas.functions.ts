import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { identificadoresNormalizados, TIPOS_OPT_OUT, type TipoOptOut } from "@/lib/optout";

// Disparo em massa — orquestrado pelo SERVIDOR (auditoria de segurança 2026-10-01, item C2).
//
// Antes, o navegador criava a campanha e os destinatários direto no banco e chamava o DocuSign por
// destinatário com qualquer signatário/template que quisesse. Agora:
//   1. criarCampanha      valida tudo (zod), limita o lote, confere o template na conta DocuSign,
//                         separa quem está na lista de descadastro (opt-out, LGPD), grava campanha +
//                         destinatários com a service_role e audita;
//   2. enviarDestinatario lê o destinatário DO BANCO, rechecha o opt-out, monta os signatários aqui,
//                         confere o dono da campanha e envia; grava status e envelope com a service_role;
//   3. concluirCampanha   fecha a campanha com os totais recalculados do banco e audita o disparo.
// O navegador só mostra o progresso.

const LIMITE_DESTINATARIOS_POR_CAMPANHA = 2000;
/**
 * Envelopes enviados por usuário nas últimas 24 h (todas as campanhas dele). A contagem lê
 * wa_campanha_destinatarios, que desde a migração 20261001140000 só o servidor escreve — o usuário
 * não consegue mais zerar a cota apagando campanhas ou mudando status pela Data API.
 */
const LIMITE_ENVELOPES_POR_DIA = 5000;

/** Chaves de dados_extras que o portal realmente usa (minimização — LGPD). */
const EXTRAS_PERMITIDOS = ["nome_conjuge", "email_conjuge", "telefone_conjuge", "cpf_conjuge"] as const;

const texto = (max: number) => z.string().trim().max(max);
const textoOpc = (max: number) => z.string().trim().max(max).nullable().optional();

const destinatarioSchema = z.object({
  nome: texto(200).min(2, "Nome do comprador obrigatório."),
  cpf: textoOpc(20).refine((v) => !v || /^\d{11}$|^\d{14}$/.test(v.replace(/\D/g, "")), "CPF/CNPJ inválido."),
  telefone: textoOpc(30).refine((v) => !v || /^\d{10,13}$/.test(v.replace(/\D/g, "")), "Telefone inválido."),
  email: textoOpc(254).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  empreendimento: textoOpc(200),
  bloco: textoOpc(50),
  unidade: textoOpc(50),
  dados_extras: z.record(z.string(), z.unknown()).optional(),
});

const configAssinaturaSchema = z.object({
  ordem: z.array(z.enum(["comprador", "conjuge", "fiador"])).max(3).default([]),
  segundo_comprador: z.enum(["assina", "cc", "nenhum"]).default("nenhum"),
  lembretes_dias: z.number().int().min(0).max(30).default(3),
  expira_dias: z.number().int().min(1).max(120).default(15),
  idioma: z.enum(["pt-BR", "en-US", "es"]).default("pt-BR"),
});

const criarSchema = z.object({
  nome: texto(120).min(1, "Dê um nome para a campanha."),
  origem: z.enum(["totvs", "excel"]),
  filtros_totvs: z
    .object({
      empreendimento_id: textoOpc(100),
      empreendimento_nome: textoOpc(200),
      empreendimento_codigo: textoOpc(100),
    })
    .default({}),
  modelo: z.object({
    id: texto(100).min(1, "Escolha o modelo do documento."),
    nome: texto(200),
    papeis: z.array(texto(100)).max(10).default([]),
  }),
  config_assinatura: configAssinaturaSchema,
  mensagem_whatsapp: texto(1000).min(1, "Informe a mensagem."),
  canais: z.enum(["whatsapp", "email", "ambos"]).default("ambos"),
  destinatarios: z
    .array(destinatarioSchema)
    .min(1, "Selecione ao menos um comprador.")
    .max(LIMITE_DESTINATARIOS_POR_CAMPANHA, `No máximo ${LIMITE_DESTINATARIOS_POR_CAMPANHA} destinatários por campanha.`),
});

export type CriarCampanhaInput = z.input<typeof criarSchema>;

type Ctx = { supabase: unknown; userId: string };
type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

function filtrarExtras(extras: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!extras) return out;
  for (const k of EXTRAS_PERMITIDOS) {
    const v = extras[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return out;
}

const MSG_OPT_OUT = "Comprador na lista de descadastro.";
const LOTE_CONSULTA_OPT_OUT = 500;
const MAX_NOMES_OPT_OUT = 20;

type DadosOptOut = {
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  dados_extras?: unknown;
};

const strOuNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Identificadores (tipo + valor normalizado) de TODOS os signatários do envelope: o comprador
 * principal e, quando a campanha inclui o 2º comprador (assina ou cópia), o cônjuge de dados_extras.
 * Basta um deles estar na lista de descadastro para o destinatário inteiro ser bloqueado.
 */
function identificadoresOptOut(d: DadosOptOut, incluirConjuge: boolean): { tipo: TipoOptOut; valor: string }[] {
  const grupos = [identificadoresNormalizados(d)];
  if (incluirConjuge) {
    const ex = (d.dados_extras && typeof d.dados_extras === "object" ? d.dados_extras : {}) as Record<string, unknown>;
    grupos.push(
      identificadoresNormalizados({
        cpf: strOuNull(ex.cpf_conjuge),
        email: strOuNull(ex.email_conjuge),
        telefone: strOuNull(ex.telefone_conjuge),
      }),
    );
  }
  const out: { tipo: TipoOptOut; valor: string }[] = [];
  for (const g of grupos) for (const tipo of TIPOS_OPT_OUT) if (g[tipo]) out.push({ tipo, valor: g[tipo] as string });
  return out;
}

/** O 2º comprador só entra no envelope (e portanto só conta para o opt-out) nestes modos. */
const incluiConjuge = (modo: string | undefined | null) => modo === "assina" || modo === "cc";

/**
 * Consulta wa_opt_outs (uma consulta `.in("valor", …)` por tipo, em lotes de 500 valores) e devolve
 * o conjunto de chaves `${tipo}:${valor}` encontradas. Falha na consulta LANÇA (fail closed): sem
 * conseguir verificar o descadastro, nada é enviado.
 */
async function buscarOptOuts(sb: SupabaseAdmin, destinatarios: DadosOptOut[], incluirConjuge: boolean): Promise<Set<string>> {
  const valoresPorTipo: Record<TipoOptOut, Set<string>> = { cpf: new Set(), email: new Set(), telefone: new Set() };
  for (const d of destinatarios) {
    for (const { tipo, valor } of identificadoresOptOut(d, incluirConjuge)) valoresPorTipo[tipo].add(valor);
  }

  const achados = new Set<string>();
  const consultas: Promise<void>[] = [];
  for (const tipo of TIPOS_OPT_OUT) {
    const valores = [...valoresPorTipo[tipo]];
    for (let i = 0; i < valores.length; i += LOTE_CONSULTA_OPT_OUT) {
      const lote = valores.slice(i, i + LOTE_CONSULTA_OPT_OUT);
      consultas.push(
        (async () => {
          const { data, error } = await sb.from("wa_opt_outs").select("tipo, valor").eq("tipo", tipo).in("valor", lote);
          if (error) throw error;
          for (const r of (data ?? []) as { tipo: string; valor: string }[]) achados.add(`${r.tipo}:${r.valor}`);
        })(),
      );
    }
  }
  try {
    await Promise.all(consultas);
  } catch (e) {
    throw (await import("@/lib/erros.server")).erroGenerico(
      "campanhas.buscarOptOuts",
      e,
      "Não foi possível verificar a lista de descadastro.",
    );
  }
  return achados;
}

/** true se algum signatário do destinatário consta no conjunto devolvido por buscarOptOuts. */
function emOptOut(d: DadosOptOut, incluirConjuge: boolean, optOuts: Set<string>): boolean {
  if (optOuts.size === 0) return false;
  return identificadoresOptOut(d, incluirConjuge).some(({ tipo, valor }) => optOuts.has(`${tipo}:${valor}`));
}

function soDigitos(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  return d || null;
}

function parseWhatsapp(raw: string | null | undefined): { countryCode: string; number: string } | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // BR: 55 + DDD(2) + 8/9 dígitos → 12 ou 13 dígitos
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return { countryCode: "55", number: digits.slice(2) };
  }
  // 10 ou 11 dígitos (DDD + número): assume Brasil
  if (digits.length === 10 || digits.length === 11) return { countryCode: "55", number: digits };
  // Fallback: primeiros 1-3 dígitos como country code (mínimo 10 dígitos restantes)
  const cc = digits.slice(0, digits.length - 10);
  const num = digits.slice(-10);
  return { countryCode: cc || "55", number: num };
}

function isEmailValido(email: string | null | undefined): email is string {
  if (!email) return false;
  const t = email.trim();
  if (t.length < 5 || t.length > 254) return false;
  if (/@no-reply\.docusign$/i.test(t)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function renderMensagemEnvio(template: string, vars: Record<string, string>): string {
  return render(template, { ...vars, link: "" }).replace(/[ \t]+\n/g, "\n").trim();
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function enviadosNasUltimas24h(sb: SupabaseAdmin, userId: string): Promise<number> {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: campanhas } = await sb.from("wa_campanhas").select("id").eq("criado_por", userId).gte("created_at", desde);
  const ids = (campanhas ?? []).map((c: { id: string }) => c.id);
  if (!ids.length) return 0;
  const { count } = await sb
    .from("wa_campanha_destinatarios")
    .select("id", { count: "exact", head: true })
    .in("campanha_id", ids)
    .eq("status", "enviado");
  return count ?? 0;
}

export type CriarCampanhaResultado = {
  campanhaId: string;
  /** Só quem pode receber o envio (status pendente); os descadastrados (opt-out) ficam de fora. */
  destinatarios: { id: string; nome: string }[];
  optOut: number;
  /** Até 20 nomes dos compradores bloqueados pelo descadastro. */
  optOutNomes: string[];
};

export const criarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const r = criarSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados da campanha inválidos.");
    return r.data;
  })
  .handler(async ({ data, context }): Promise<CriarCampanhaResultado> => {
    const ctx = context as unknown as Ctx;
    const { assertOperacao, templateExisteDocusign } = await import("@/lib/integracoes/docusign.functions");
    const { auditar } = await import("@/lib/auditoria.server");
    await assertOperacao(ctx);
    const sb = await admin();

    // Lista de descadastro (LGPD): quem consta nela entra na campanha como 'opt_out' e não vai para a fila.
    const conjugeNoEnvelope = incluiConjuge(data.config_assinatura.segundo_comprador);
    const optOuts = await buscarOptOuts(sb, data.destinatarios, conjugeNoEnvelope);
    const bloqueados = data.destinatarios.map((d) => emOptOut(d, conjugeNoEnvelope, optOuts));
    const qtdOptOut = bloqueados.filter(Boolean).length;
    const aEnviar = data.destinatarios.length - qtdOptOut;

    // Cota diária por usuário (só conta quem realmente vai receber).
    const jaEnviados = await enviadosNasUltimas24h(sb, ctx.userId);
    if (jaEnviados + aEnviar > LIMITE_ENVELOPES_POR_DIA) {
      throw new Error(`Limite de ${LIMITE_ENVELOPES_POR_DIA} envios por dia atingido. Fale com um administrador.`);
    }

    // O modelo precisa existir na conta DocuSign configurada.
    if (!(await templateExisteDocusign(data.modelo.id))) {
      throw new Error("O modelo escolhido não existe na conta DocuSign configurada.");
    }

    const { data: camp, error } = await sb
      .from("wa_campanhas")
      .insert({
        nome: data.nome,
        criado_por: ctx.userId,
        origem: data.origem,
        filtros_origem: data.filtros_totvs as never,
        modelo_docusign_id: data.modelo.id,
        modelo_docusign_nome: data.modelo.nome,
        config_assinatura: { ...data.config_assinatura, canais: data.canais, papeis_modelo: data.modelo.papeis } as never,
        mensagem_whatsapp: data.mensagem_whatsapp,
        status: "em_execucao",
        totais: { destinatarios: data.destinatarios.length, enviados: 0, erros: 0, opt_out: qtdOptOut } as never,
      })
      .select("id")
      .single();
    if (error || !camp) {
      console.error("[campanhas] criar:", error?.message);
      throw new Error("Não foi possível criar a campanha.");
    }

    const rows = data.destinatarios.map((d, i) => ({
      campanha_id: camp.id,
      nome: d.nome,
      cpf: soDigitos(d.cpf),
      telefone: soDigitos(d.telefone),
      email: d.email?.trim().toLowerCase() || null,
      empreendimento: d.empreendimento || null,
      bloco: d.bloco || null,
      unidade: d.unidade || null,
      dados_extras: filtrarExtras(d.dados_extras) as never,
      status: bloqueados[i] ? ("opt_out" as const) : ("pendente" as const),
      erro_msg: bloqueados[i] ? MSG_OPT_OUT : null,
    }));
    const { data: inseridos, error: e2 } = await sb.from("wa_campanha_destinatarios").insert(rows).select("id, nome, status");
    if (e2) {
      console.error("[campanhas] destinatários:", e2.message);
      await sb.from("wa_campanhas").update({ status: "erro" }).eq("id", camp.id);
      throw new Error("Não foi possível gravar os destinatários da campanha.");
    }

    await auditar({
      userId: ctx.userId,
      acao: "campanha_criada",
      entidade: "campanha",
      entidadeId: camp.id,
      detalhes: {
        nome: data.nome,
        origem: data.origem,
        modelo: data.modelo.nome,
        destinatarios: rows.length,
        canais: data.canais,
        opt_out: qtdOptOut,
      },
    });

    return {
      campanhaId: camp.id,
      destinatarios: ((inseridos ?? []) as { id: string; nome: string; status: string }[])
        .filter((d) => d.status === "pendente")
        .map((d) => ({ id: d.id, nome: d.nome })),
      optOut: qtdOptOut,
      optOutNomes: data.destinatarios.filter((_, i) => bloqueados[i]).map((d) => d.nome).slice(0, MAX_NOMES_OPT_OUT),
    };
  });

export type EnvioDestinatarioResultado = {
  ok: boolean;
  envelopeId?: string | null;
  erro?: string;
  warning?: string;
  /** Destinatário na lista de descadastro: não foi enviado e não conta como erro. */
  optOut?: boolean;
};

export const enviarDestinatarioCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ campanhaId: z.string().uuid(), destinatarioId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EnvioDestinatarioResultado> => {
    const ctx = context as unknown as Ctx;
    const { assertOperacao, assertCampanhaDoUsuario, enviarEnvelopeCore } = await import(
      "@/lib/integracoes/docusign.functions"
    );
    await assertOperacao(ctx);
    await assertCampanhaDoUsuario(ctx, data.campanhaId);
    const sb = await admin();

    const [{ data: camp }, { data: dest }] = await Promise.all([
      sb
        .from("wa_campanhas")
        .select("id, status, modelo_docusign_id, config_assinatura, mensagem_whatsapp")
        .eq("id", data.campanhaId)
        .maybeSingle(),
      sb
        .from("wa_campanha_destinatarios")
        .select("id, campanha_id, nome, cpf, telefone, email, empreendimento, bloco, unidade, dados_extras, status")
        .eq("id", data.destinatarioId)
        .maybeSingle(),
    ]);
    if (!camp || !dest || dest.campanha_id !== camp.id) throw new Error("Destinatário não pertence a esta campanha.");
    if (camp.status !== "em_execucao") throw new Error("Esta campanha não está em execução.");
    if (dest.status === "opt_out") return { ok: false, envelopeId: null, erro: MSG_OPT_OUT, optOut: true };
    if (dest.status !== "pendente") return { ok: dest.status === "enviado", envelopeId: null, erro: "Destinatário já processado." };
    if (!camp.modelo_docusign_id) throw new Error("Campanha sem modelo de documento.");

    const cfg = (camp.config_assinatura ?? {}) as {
      segundo_comprador?: "assina" | "cc" | "nenhum";
      idioma?: "pt-BR" | "en-US" | "es";
      canais?: "whatsapp" | "email" | "ambos";
      papeis_modelo?: string[];
    };
    const canais = cfg.canais ?? "ambos";
    const enviaWhatsapp = canais === "whatsapp" || canais === "ambos";
    const enviaEmail = canais === "email" || canais === "ambos";
    const papeis = cfg.papeis_modelo ?? [];
    const papelPrincipal = papeis[0] ?? "Comprador";
    const papelSegundo = papeis[1] ?? papelPrincipal;

    // erro_msg vai para o relatório/CSV: só mensagens curtas e genéricas (N10). O que chega aqui do
    // DocuSign já é o resumo de erros.server.resumirErroDocusign (código/status, nunca o corpo).
    const marcarErro = async (msg: unknown): Promise<EnvioDestinatarioResultado> => {
      const texto = String(msg ?? "Erro no envio").slice(0, 200);
      await sb.from("wa_campanha_destinatarios").update({ status: "erro", erro_msg: texto }).eq("id", dest.id);
      return { ok: false, envelopeId: null, erro: texto };
    };

    try {
      // Recheca o descadastro (LGPD) logo antes de enviar: o titular pode ter pedido para sair depois
      // de a campanha ser criada. Falha na consulta lança → cai no catch (nada é enviado).
      const optOuts = await buscarOptOuts(sb, [dest], incluiConjuge(cfg.segundo_comprador));
      if (emOptOut(dest, incluiConjuge(cfg.segundo_comprador), optOuts)) {
        await sb.from("wa_campanha_destinatarios").update({ status: "opt_out", erro_msg: MSG_OPT_OUT }).eq("id", dest.id);
        return { ok: false, envelopeId: null, erro: MSG_OPT_OUT, optOut: true };
      }

      let waPrincipal: { countryCode: string; number: string } | null = null;
      if (enviaWhatsapp) {
        if (!dest.telefone) return await marcarErro("Destinatário sem telefone para envio via WhatsApp");
        waPrincipal = parseWhatsapp(dest.telefone);
        if (!waPrincipal) return await marcarErro("Telefone inválido para WhatsApp");
      }
      if (enviaEmail && !isEmailValido(dest.email)) return await marcarErro("E-mail do destinatário ausente ou inválido");
      // DocuSign exige e-mail para criar o signatário mesmo quando o canal é apenas WhatsApp.
      if (!isEmailValido(dest.email)) return await marcarErro("E-mail é obrigatório para criar o envelope no DocuSign");
      const emailPrincipal = dest.email.trim();

      const extras = (dest.dados_extras ?? {}) as Record<string, unknown>;
      const emailSegundo = typeof extras.email_conjuge === "string" ? extras.email_conjuge : null;
      const nomeSegundo = typeof extras.nome_conjuge === "string" ? extras.nome_conjuge : null;
      const telSegundo = typeof extras.telefone_conjuge === "string" ? extras.telefone_conjuge : null;
      const waSegundo = telSegundo ? parseWhatsapp(telSegundo) : null;
      const emailSegundoValido = isEmailValido(emailSegundo);

      const nome = dest.nome;
      const empreendimento = dest.empreendimento ?? "";
      const bloco = dest.bloco ?? "";
      const unidade = dest.unidade ?? "";
      const templateVars: Record<string, string> = {
        comprador_1: nome,
        "COMPRADOR 1": nome,
        comprador_2: nomeSegundo ?? "",
        "COMPRADOR 2": nomeSegundo ?? "",
        nome,
        NOME: nome,
        Nome: nome,
        empreendimento,
        EMPREENDIMENTO: empreendimento,
        Empreendimento: empreendimento,
        bloco,
        BLOCO: bloco,
        Bloco: bloco,
        unidade,
        UNIDADE: unidade,
        Unidade: unidade,
      };

      const signers: {
        email: string;
        name: string;
        roleName: string;
        tabs?: Record<string, string>;
        whatsapp?: { countryCode: string; number: string };
      }[] = [
        {
          email: emailPrincipal,
          name: nome,
          roleName: papelPrincipal,
          ...(waPrincipal ? { whatsapp: waPrincipal } : {}),
          tabs: templateVars,
        },
      ];
      const carbonCopies: { email: string; name: string; roleName?: string }[] = [];

      if (cfg.segundo_comprador === "assina" && nomeSegundo && emailSegundoValido && (!enviaWhatsapp || waSegundo)) {
        signers.push({
          email: (emailSegundo as string).trim(),
          name: nomeSegundo,
          roleName: papelSegundo,
          tabs: templateVars,
          ...(enviaWhatsapp && waSegundo ? { whatsapp: waSegundo } : {}),
        });
      } else if (cfg.segundo_comprador === "cc" && emailSegundoValido && nomeSegundo) {
        carbonCopies.push({ email: (emailSegundo as string).trim(), name: nomeSegundo });
      }

      const mensagemEnvio = renderMensagemEnvio(camp.mensagem_whatsapp, { nome, empreendimento, unidade });
      const emailSubject = mensagemEnvio.slice(0, 100) || `Assinatura - ${nome}`;

      const res = await enviarEnvelopeCore({
        templateId: camp.modelo_docusign_id,
        emailSubject,
        messageBody: mensagemEnvio,
        idioma: cfg.idioma,
        signers,
        carbonCopies: carbonCopies.length ? carbonCopies : undefined,
        viaWhatsapp: enviaWhatsapp,
        campanhaId: camp.id,
        destinatarioId: dest.id,
      });

      if (!res.envelopeId) return await marcarErro(res.error ?? "Falha desconhecida no DocuSign");

      await sb
        .from("wa_campanha_destinatarios")
        .update({ status: "enviado", envelope_docusign_id: res.envelopeId, enviado_em: new Date().toISOString(), erro_msg: null })
        .eq("id", dest.id);
      return { ok: true, envelopeId: res.envelopeId, warning: res.warning };
    } catch (err) {
      // Qualquer exceção inesperada: detalhe só no log, erro_msg genérico.
      (await import("@/lib/erros.server")).logErro("campanhas.enviarDestinatario", err, { destinatarioId: dest.id });
      return await marcarErro("Erro inesperado no envio.");
    }
  });

export const concluirCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ campanhaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ status: string; destinatarios: number; enviados: number; erros: number; optOut: number }> => {
    const ctx = context as unknown as Ctx;
    const { assertOperacao, assertCampanhaDoUsuario } = await import("@/lib/integracoes/docusign.functions");
    const { auditar } = await import("@/lib/auditoria.server");
    await assertOperacao(ctx);
    await assertCampanhaDoUsuario(ctx, data.campanhaId);
    const sb = await admin();

    const { data: dests } = await sb.from("wa_campanha_destinatarios").select("status").eq("campanha_id", data.campanhaId);
    const lista = (dests ?? []) as { status: string }[];
    const enviados = lista.filter((d) => d.status === "enviado").length;
    const erros = lista.filter((d) => d.status === "erro").length;
    const pendentes = lista.filter((d) => d.status === "pendente").length;
    // Descadastrados (opt-out) não são enviados nem contam como erro: ficam num total à parte.
    const optOut = lista.filter((d) => d.status === "opt_out").length;

    // Pendentes que sobraram (aba fechada no meio do disparo) ficam marcados como erro para não
    // parecerem "enviados depois" — o reenvio pode ser feito pela tela de relatório.
    if (pendentes > 0) {
      await sb
        .from("wa_campanha_destinatarios")
        .update({ status: "erro", erro_msg: "Disparo interrompido antes de processar este destinatário." })
        .eq("campanha_id", data.campanhaId)
        .eq("status", "pendente");
    }
    const totalErros = erros + pendentes;
    const status = totalErros === 0 ? "concluida" : "erro";

    await sb
      .from("wa_campanhas")
      .update({ status, totais: { destinatarios: lista.length, enviados, erros: totalErros, opt_out: optOut } as never })
      .eq("id", data.campanhaId);

    await auditar({
      userId: ctx.userId,
      acao: "campanha_disparada",
      entidade: "campanha",
      entidadeId: data.campanhaId,
      detalhes: { destinatarios: lista.length, enviados, erros: totalErros, opt_out: optOut, status },
    });

    return { status, destinatarios: lista.length, enviados, erros: totalErros, optOut };
  });
