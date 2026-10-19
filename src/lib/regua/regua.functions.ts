import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  exigirPermissao,
  imobiliariaDoContexto,
  temPermissao,
  type ContextoAutenticado,
} from "@/lib/authz";
import type { PermissionId } from "@/config/menu-registry";
import type {
  Canal,
  ProntidaoTemplate,
  RegraSenha,
  ReguaSugerida,
  StatusBoleto,
  StatusContato,
  StatusLote,
  StatusRegistro,
  StatusTentativa,
} from "./comum";
import type { Contadores } from "./lote.functions";

// Régua de Cobrança — biblioteca de templates, configurações, Painel, Lotes, detalhe, trilha e exportação.
// Leitura e escrita pelo servidor (service_role) sempre filtradas pela imobiliária do usuário logado.

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

const ctx = (c: unknown) => c as ContextoAutenticado;
const uuid = z.string().uuid("Identificador inválido.");

async function exigirAlguma(context: ContextoAutenticado, ids: PermissionId[], mensagem: string) {
  for (const id of ids) if (await temPermissao(context, id)) return;
  throw new Error(mensagem);
}

async function nomeDoUsuario(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("nome, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.nome || data?.email || "—";
}

// ================================================================ Templates (biblioteca — D10)

export interface TemplateRegua {
  id: string;
  nome: string;
  canal: Canal;
  reguaSugerida: ReguaSugerida | null;
  ativo: boolean;
  whatsappTemplateId: string | null;
  remetenteId: string | null;
  mapaVariaveis: Record<string, string>;
  usaDocumento: boolean;
  assunto: string | null;
  corpo: string | null;
  anexoTipo: "pdf_link" | "link";
  prontidao: ProntidaoTemplate;
  ultimoUso: { numero: number; em: string } | null;
  atualizadoEm: string;
  atualizadoPor: string | null;
}

export interface BibliotecaTemplates {
  templates: TemplateRegua[];
  whatsapp: {
    id: string;
    nome: string;
    status: string;
    headerTipo: string | null;
    corpo: string | null;
    variaveis: string[];
    senderId: string | null;
    categoria: string | null;
    idioma: string | null;
  }[];
  remetentes: {
    id: string;
    numero: string;
    nome: string | null;
    setor: string | null;
    ativo: boolean;
    padrao: boolean;
  }[];
  emailPronto: {
    ok: boolean;
    motivo: string | null;
    provedor: string | null;
    remetente: string | null;
  };
  podeEditar: boolean;
}

export const bibliotecaTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BibliotecaTemplates> => {
    await exigirAlguma(
      ctx(context),
      ["regua_templates", "regua_lote_criar", "regua_auditoria_ver"],
      "Seu perfil não vê os templates da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { prontidaoEmail, prontidaoWhatsapp } = await import("./comum");
    const [tpl, wa, rem, lotes, prov] = await Promise.all([
      supabaseAdmin
        .from("regua_template")
        .select("*")
        .eq("imobiliaria_id", imob)
        .order("canal")
        .order("nome"),
      supabaseAdmin.from("whatsapp_template").select("*").eq("imobiliaria_id", imob).order("nome"),
      supabaseAdmin
        .from("whatsapp_remetente")
        .select("*")
        .eq("imobiliaria_id", imob)
        .order("numero"),
      supabaseAdmin
        .from("regua_lote")
        .select("numero, iniciado_em, template_whatsapp_id, template_email_id")
        .eq("imobiliaria_id", imob)
        .not("iniciado_em", "is", null)
        .order("iniciado_em", { ascending: false })
        .limit(300),
      supabaseAdmin.from("email_provedor").select("*").eq("imobiliaria_id", imob).maybeSingle(),
    ]);
    const waPorId = new Map((wa.data ?? []).map((w) => [w.id, w]));
    const uso = new Map<string, { numero: number; em: string }>();
    for (const l of lotes.data ?? []) {
      for (const id of [l.template_whatsapp_id, l.template_email_id])
        if (id && !uso.has(id)) uso.set(id, { numero: Number(l.numero), em: l.iniciado_em! });
    }
    const p = prov.data;
    let motivo: string | null = null;
    if (!p?.ativo) motivo = "Nenhum provedor de e-mail ativo (Integrações › E-mail).";
    else if (!p.remetente_email) motivo = "Remetente de e-mail não informado.";
    else if (p.tipo === "resend" && p.status_dominio !== "verified")
      motivo = `Domínio ${p.dominio ?? ""} ainda não verificado no Resend.`;
    return {
      templates: (tpl.data ?? []).map((t) => {
        const w = t.whatsapp_template_id ? waPorId.get(t.whatsapp_template_id) : undefined;
        const mapa = (t.mapa_variaveis ?? {}) as Record<string, string>;
        return {
          id: t.id,
          nome: t.nome,
          canal: t.canal as Canal,
          reguaSugerida: (t.regua_sugerida as ReguaSugerida | null) ?? null,
          ativo: t.ativo,
          whatsappTemplateId: t.whatsapp_template_id,
          remetenteId: t.remetente_id,
          mapaVariaveis: mapa,
          usaDocumento: t.usa_documento,
          assunto: t.assunto,
          corpo: t.corpo,
          anexoTipo: t.anexo_tipo as "pdf_link" | "link",
          prontidao:
            t.canal === "whatsapp"
              ? prontidaoWhatsapp({
                  ativo: t.ativo,
                  whatsapp: w
                    ? {
                        status: w.status,
                        variaveis: (w.variaveis as string[]) ?? [],
                        header_tipo: w.header_tipo,
                      }
                    : null,
                  mapa_variaveis: mapa,
                  usa_documento: t.usa_documento,
                  remetente_id: t.remetente_id,
                })
              : prontidaoEmail(t),
          ultimoUso: uso.get(t.id) ?? null,
          atualizadoEm: t.atualizado_em,
          atualizadoPor: t.atualizado_por,
        };
      }),
      whatsapp: (wa.data ?? []).map((w) => ({
        id: w.id,
        nome: w.nome,
        status: w.status,
        headerTipo: w.header_tipo,
        corpo: w.corpo,
        variaveis: (w.variaveis as string[]) ?? [],
        senderId: w.sender_id,
        categoria: w.categoria,
        idioma: w.idioma,
      })),
      remetentes: (rem.data ?? []).map((r) => ({
        id: r.id,
        numero: r.numero,
        nome: r.nome,
        setor: r.setor,
        ativo: r.status === "ativo",
        padrao: r.padrao_regua,
      })),
      emailPronto: {
        ok: !motivo,
        motivo,
        provedor: p?.tipo ?? null,
        remetente: p?.remetente_email ?? null,
      },
      podeEditar: await temPermissao(ctx(context), "regua_templates"),
    };
  });

const templateSchema = z
  .object({
    id: uuid.optional(),
    nome: z.string().trim().min(2, "Dê um nome ao template.").max(80, "Nome muito longo."),
    canal: z.enum(["whatsapp", "email"]),
    reguaSugerida: z.enum(["a_vencer", "30", "60", "90", "90+"]).nullable().optional(),
    ativo: z.boolean().default(true),
    whatsappTemplateId: uuid.nullable().optional(),
    remetenteId: uuid.nullable().optional(),
    mapaVariaveis: z.record(z.string().max(40)).default({}),
    usaDocumento: z.boolean().default(true),
    assunto: z.string().trim().max(200).nullable().optional(),
    corpo: z.string().max(20000).nullable().optional(),
    anexoTipo: z.enum(["pdf_link", "link"]).default("pdf_link"),
  })
  .superRefine((v, c) => {
    if (v.canal === "email" && (!v.assunto?.trim() || !v.corpo?.trim()))
      c.addIssue({ code: "custom", message: "Preencha assunto e corpo do e-mail." });
  });

export const salvarTemplateRegua = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(templateSchema))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_templates",
      "Seu perfil não edita os templates da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const comum = await import("./comum");

    if (data.canal === "whatsapp") {
      if (data.whatsappTemplateId) {
        const { data: w } = await supabaseAdmin
          .from("whatsapp_template")
          .select("variaveis, status")
          .eq("id", data.whatsappTemplateId)
          .eq("imobiliaria_id", imob)
          .maybeSingle();
        if (!w)
          throw new Error(
            "Template Zenvia não encontrado. Sincronize em Integrações › Zenvia WhatsApp.",
          );
        const faltam = ((w.variaveis as string[]) ?? []).filter(
          (v) => !comum.ehCampoBoleto(data.mapaVariaveis[v] ?? ""),
        );
        // Regra do PRD: variável sem mapeamento impede salvar.
        if (faltam.length)
          throw new Error(
            `Escolha o campo do boleto para: ${faltam.map((v) => `{{${v}}}`).join(", ")}.`,
          );
      }
    } else {
      const invalidas = [
        ...comum.variaveisDe(data.assunto),
        ...comum.variaveisDe(data.corpo),
      ].filter((v) => !comum.ehCampoBoleto(v));
      if (invalidas.length)
        throw new Error(`Variável desconhecida: ${invalidas.map((v) => `{{${v}}}`).join(", ")}.`);
    }

    const linha = {
      imobiliaria_id: imob,
      nome: data.nome,
      canal: data.canal,
      regua_sugerida: data.reguaSugerida ?? null,
      ativo: data.ativo,
      whatsapp_template_id: data.canal === "whatsapp" ? (data.whatsappTemplateId ?? null) : null,
      remetente_id: data.canal === "whatsapp" ? (data.remetenteId ?? null) : null,
      mapa_variaveis: data.canal === "whatsapp" ? data.mapaVariaveis : {},
      usa_documento: data.canal === "whatsapp" ? data.usaDocumento : true,
      assunto: data.canal === "email" ? (data.assunto ?? null) : null,
      corpo: data.canal === "email" ? (data.corpo ?? null) : null,
      anexo_tipo: data.anexoTipo,
      atualizado_por: await nomeDoUsuario(ctx(context).userId),
    };
    let antes: Record<string, unknown> | null = null;
    let id = data.id;
    if (id) {
      const { data: a } = await supabaseAdmin
        .from("regua_template")
        .select("*")
        .eq("id", id)
        .eq("imobiliaria_id", imob)
        .maybeSingle();
      if (!a) throw new Error("Template não encontrado.");
      antes = a;
      const { error } = await supabaseAdmin.from("regua_template").update(linha).eq("id", id);
      if (error)
        throw new Error(
          /duplicate|unique/i.test(error.message)
            ? "Já existe um template com este nome neste canal."
            : "Não foi possível salvar o template.",
        );
    } else {
      const { data: novo, error } = await supabaseAdmin
        .from("regua_template")
        .insert(linha)
        .select("id")
        .single();
      if (error || !novo)
        throw new Error(
          error && /duplicate|unique/i.test(error.message)
            ? "Já existe um template com este nome neste canal."
            : "Não foi possível criar o template.",
        );
      id = novo.id;
    }
    await auditar({
      userId: ctx(context).userId,
      acao: data.id ? "regua_template_alterado" : "regua_template_criado",
      entidade: "regua_template",
      entidadeId: id,
      detalhes: {
        antes: antes
          ? {
              nome: antes.nome,
              ativo: antes.ativo,
              assunto: antes.assunto,
              mapa: antes.mapa_variaveis,
              whatsapp_template_id: antes.whatsapp_template_id,
            }
          : null,
        depois: {
          nome: linha.nome,
          ativo: linha.ativo,
          assunto: linha.assunto,
          mapa: linha.mapa_variaveis,
          whatsapp_template_id: linha.whatsapp_template_id,
        },
      },
    });
    return { id };
  });

export const excluirTemplateRegua = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ id: uuid })))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_templates",
      "Seu perfil não edita os templates da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { data: t } = await supabaseAdmin
      .from("regua_template")
      .select("nome")
      .eq("id", data.id)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!t) throw new Error("Template não encontrado.");
    const { error } = await supabaseAdmin
      .from("regua_template")
      .delete()
      .eq("id", data.id)
      .eq("imobiliaria_id", imob);
    let desativado = false;
    if (error) {
      // Usado por algum lote (histórico): não apaga, desativa.
      await supabaseAdmin.from("regua_template").update({ ativo: false }).eq("id", data.id);
      desativado = true;
    }
    await auditar({
      userId: ctx(context).userId,
      acao: desativado ? "regua_template_desativado" : "regua_template_excluido",
      entidade: "regua_template",
      entidadeId: data.id,
      detalhes: { nome: t.nome },
    });
    return { desativado };
  });

/** Teste de um template com dados de exemplo (PDF de exemplo com senha 12345). */
export const enviarTesteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ id: uuid, para: z.string().trim().min(5).max(254) })))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_templates",
      "Seu perfil não edita os templates da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const envio = await import("./envio.server");
    const comum = await import("./comum");
    const { gerarBoletoPdf } = await import("./pdf.server");
    const { data: tpl } = await supabaseAdmin
      .from("regua_template")
      .select("canal")
      .eq("id", data.id)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!tpl) throw new Error("Template não encontrado.");
    const { data: imobiliaria } = await supabaseAdmin
      .from("imobiliarias")
      .select("nome")
      .eq("id", imob)
      .maybeSingle();

    const exemplo = {
      cliente_nome: "Cliente de Teste",
      empreendimento: "Empreendimento Exemplo",
      unidade: "Bl A 101",
      numero: "000000001",
      vencimento: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10),
      dias_atraso: 45,
      valor: 1234.56,
      linha_digitavel: "34191090080184522109200000000002000000000123456",
    };
    const pdf = await gerarBoletoPdf(
      {
        beneficiario: imobiliaria?.nome ?? "Imobiliária",
        clienteNome: exemplo.cliente_nome,
        cpfCnpj: "12345678909",
        empreendimento: exemplo.empreendimento,
        unidade: exemplo.unidade,
        numero: exemplo.numero,
        vencimento: exemplo.vencimento,
        diasAtraso: exemplo.dias_atraso,
        valor: exemplo.valor,
        linhaDigitavel: exemplo.linha_digitavel,
      },
      "12345",
    );
    const caminho = `${imob}/teste/${data.id}.pdf`;
    await supabaseAdmin.storage
      .from(envio.BUCKET)
      .upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
    const assinada = await supabaseAdmin.storage
      .from(envio.BUCKET)
      .createSignedUrl(caminho, 6 * 3600, { download: "boleto-teste.pdf" });
    const url = assinada.data?.signedUrl ?? "";
    const dados = comum.dadosDaMensagem({
      ...exemplo,
      link: url,
      dica: "Teste: a senha do PDF é 12345.",
    });

    let ok = false;
    let id: string | null = null;
    let erro: string | null = null;
    if (tpl.canal === "whatsapp") {
      const t = await envio.carregarTemplateWhatsapp(imob, data.id);
      const { lerSegredo } = await import("@/lib/integracoes/segredos.server");
      const token = await lerSegredo("zenvia_token", imob);
      if (!token) throw new Error("Cadastre o token da Zenvia em Integrações › Zenvia WhatsApp.");
      if (!comum.telefoneValido(data.para)) throw new Error("Telefone inválido (com DDD).");
      const m = comum.montarWhatsapp({ corpo: t.corpo, variaveis: t.variaveis }, t.mapa, dados);
      const { enviarTemplateWhatsapp } = await import("@/lib/integracoes/zenvia.server");
      const r = await enviarTemplateWhatsapp(token, {
        from: t.remetente!,
        to: comum.telefoneE164(data.para),
        templateId: t.zenviaId,
        fields: m.fields,
        documentoUrl: t.usaDocumento ? url : null,
      });
      ok = r.ok && !!r.id;
      id = r.id;
      erro = r.erro;
    } else {
      if (!comum.emailValido(data.para)) throw new Error("E-mail inválido.");
      const t = await envio.carregarTemplateEmail(imob, data.id);
      const p = await envio.remetenteEmailPronto(imob, { exigirAtivo: false });
      const { enviarEmail } = await import("@/lib/integracoes/email.server");
      const texto = comum.preencher(t.corpo, dados);
      const r = await enviarEmail(p.provedor, p.credencial, {
        from: p.from,
        fromEmail: p.fromEmail,
        fromNome: p.fromNome,
        to: data.para,
        assunto: `[TESTE] ${comum.preencher(t.assunto, dados)}`,
        html: comum.textoParaHtml(texto),
        texto,
        replyTo: p.replyTo,
        anexo: t.anexo === "pdf_link" ? { nome: "boleto-teste.pdf", conteudo: pdf, url } : null,
      });
      ok = r.ok;
      id = r.id;
      erro = r.erro;
    }
    await auditar({
      userId: ctx(context).userId,
      acao: "regua_template_teste",
      entidade: "regua_template",
      entidadeId: data.id,
      detalhes: { canal: tpl.canal, ok, id },
    });
    if (!ok) throw new Error(erro ?? "O provedor recusou o envio.");
    return {
      id,
      aviso:
        tpl.canal === "whatsapp"
          ? "A Zenvia aceitou. A entrega só é confirmada pelo status que chega no webhook."
          : "O provedor aceitou o e-mail.",
    };
  });

// ================================================================ Configurações (RF-12, RF-13)

export interface ConfigRegua {
  regraSenha: RegraSenha;
  textoDica: string;
  validadeLinkHoras: number;
  intervaloWhatsappSeg: number;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
  pdfsAtivos: number;
}

export const obterConfigRegua = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConfigRegua> => {
    await exigirAlguma(
      ctx(context),
      ["regua_config_editar", "regua_lote_criar"],
      "Seu perfil não vê as configurações da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: c } = await supabaseAdmin
      .from("regua_config")
      .select("*")
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!c) {
      await supabaseAdmin.from("regua_config").upsert({ imobiliaria_id: imob });
      c = (await supabaseAdmin.from("regua_config").select("*").eq("imobiliaria_id", imob).single())
        .data;
    }
    const { count } = await supabaseAdmin
      .from("regua_documento")
      .select("id", { count: "exact", head: true })
      .eq("imobiliaria_id", imob)
      .is("removido_em", null);
    return {
      regraSenha: c!.regra_senha as RegraSenha,
      textoDica: c!.texto_dica,
      validadeLinkHoras: c!.validade_link_horas,
      intervaloWhatsappSeg: c!.intervalo_whatsapp_seg,
      atualizadoEm: c!.atualizado_em,
      atualizadoPor: c!.atualizado_por,
      pdfsAtivos: count ?? 0,
    };
  });

export const salvarConfigRegua = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        regraSenha: z.enum(["cpf_5_primeiros", "cpf_4_ultimos", "cpf_6_primeiros"]),
        textoDica: z
          .string()
          .trim()
          .min(5, "Escreva a dica da senha.")
          .max(200, "Dica muito longa."),
        validadeLinkHoras: z
          .number()
          .int()
          .min(6, "Mínimo de 6 horas.")
          .max(720, "Máximo de 720 horas."),
        intervaloWhatsappSeg: z.number().int().min(0).max(60, "Máximo de 60 segundos."),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_config_editar",
      "Seu perfil não altera as configurações da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { data: antes } = await supabaseAdmin
      .from("regua_config")
      .select("*")
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    const depois = {
      imobiliaria_id: imob,
      regra_senha: data.regraSenha,
      texto_dica: data.textoDica,
      validade_link_horas: data.validadeLinkHoras,
      intervalo_whatsapp_seg: data.intervaloWhatsappSeg,
      atualizado_por: await nomeDoUsuario(ctx(context).userId),
    };
    const { error } = await supabaseAdmin.from("regua_config").upsert(depois);
    if (error) throw new Error("Não foi possível salvar as configurações.");
    await auditar({
      userId: ctx(context).userId,
      acao: "regua_config_salva",
      entidade: "regua_config",
      entidadeId: imob,
      detalhes: {
        antes: antes
          ? {
              regra: antes.regra_senha,
              dica: antes.texto_dica,
              validade: antes.validade_link_horas,
              intervalo: antes.intervalo_whatsapp_seg,
            }
          : null,
        depois: {
          regra: depois.regra_senha,
          dica: depois.texto_dica,
          validade: depois.validade_link_horas,
          intervalo: depois.intervalo_whatsapp_seg,
        },
      },
    });
    return { ok: true };
  });

export const removerPdfsVencidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_config_editar",
      "Seu perfil não altera as configurações da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { removerDocumentosVencidos } = await import("./envio.server");
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const n = await removerDocumentosVencidos(imob, 100);
      total += n;
      if (n < 100) break;
    }
    return { removidos: total };
  });

// ================================================================ Painel (RF-01 a RF-03)

export interface DadosPainel {
  elegiveis: number;
  sucesso: number;
  boletos: number;
  invalidos: number;
  nao_registrados: number;
  falhas: number;
  whatsapp: { enviados: number; entregues: number };
  email: { enviados: number; entregues: number };
  tempo_medio_seg: number;
  por_dia: { dia: string; whatsapp: number; email: number }[];
  por_empreendimento: { empreendimento: string; boletos: number; sucesso: number }[];
  empreendimentos: string[];
  ultimos: ResumoLote[];
}

export const painelRegua = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        empreendimento: z.string().max(120).nullable().optional(),
        canal: z.enum(["whatsapp", "email"]).nullable().optional(),
        regua: z.enum(["a_vencer", "30", "60", "90", "90+"]).nullable().optional(),
        status: z
          .enum(["em_processamento", "concluido", "concluido_com_falhas", "cancelado"])
          .nullable()
          .optional(),
        loteId: uuid.nullable().optional(),
      }),
    ),
  )
  .handler(async ({ data, context }): Promise<DadosPainel> => {
    await exigirPermissao(
      ctx(context),
      "regua_dashboard_ver",
      "Seu perfil não vê o painel da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin.rpc("regua_painel", {
      p_imobiliaria: imob,
      p_de: data.de,
      p_ate: data.ate,
      p_empreendimento: data.empreendimento ?? undefined,
      p_canal: data.canal ?? undefined,
      p_regua: data.regua ?? undefined,
      p_lote: data.loteId ?? undefined,
      p_status: data.status ?? undefined,
    });
    if (error) {
      const { erroGenerico } = await import("@/lib/erros.server");
      throw erroGenerico("regua.painel", error, "Não foi possível carregar o painel.");
    }
    const ultimos = await listarResumoLotes(imob, { limite: 8 });
    return { ...(p as unknown as Omit<DadosPainel, "ultimos">), ultimos };
  });

// ================================================================ Lotes (RF-07)

export interface ResumoLote {
  id: string;
  numero: number;
  titulo: string;
  tipoRegua: "a_vencer" | "atraso";
  faixa: string | null;
  origem: "rm" | "planilha";
  tipo: "normal" | "extraordinario";
  status: StatusLote;
  usuario: string | null;
  criadoEm: string;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  canais: Canal[];
  contadores: Partial<Contadores>;
}

async function listarResumoLotes(
  imob: string,
  f: { limite: number; status?: string | null; busca?: string | null; pagina?: number },
): Promise<ResumoLote[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("regua_lote")
    .select(
      "id, numero, titulo, tipo_regua, faixa_atraso, origem, tipo, status, usuario_nome, criado_em, iniciado_em, finalizado_em, canais, contadores",
    )
    .eq("imobiliaria_id", imob)
    .order("criado_em", { ascending: false })
    .range((f.pagina ?? 0) * f.limite, (f.pagina ?? 0) * f.limite + f.limite - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.busca) {
    const b = f.busca.replace(/[%,()]/g, "");
    q = /^\d+$/.test(b)
      ? q.or(`numero.eq.${b},titulo.ilike.%${b}%`)
      : q.or(`titulo.ilike.%${b}%,usuario_nome.ilike.%${b}%`);
  }
  const { data } = await q;
  return (data ?? []).map((l) => ({
    id: l.id,
    numero: Number(l.numero),
    titulo: l.titulo,
    tipoRegua: l.tipo_regua as "a_vencer" | "atraso",
    faixa: l.faixa_atraso,
    origem: l.origem as "rm" | "planilha",
    tipo: l.tipo as "normal" | "extraordinario",
    status: l.status as StatusLote,
    usuario: l.usuario_nome,
    criadoEm: l.criado_em,
    iniciadoEm: l.iniciado_em,
    finalizadoEm: l.finalizado_em,
    canais: l.canais as Canal[],
    contadores: (l.contadores ?? {}) as Partial<Contadores>,
  }));
}

export const listarLotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        status: z
          .enum(["rascunho", "em_processamento", "concluido", "concluido_com_falhas", "cancelado"])
          .nullable()
          .optional(),
        busca: z.string().trim().max(80).nullable().optional(),
        pagina: z.number().int().min(0).max(500).default(0),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirAlguma(
      ctx(context),
      ["regua_auditoria_ver", "regua_lote_criar"],
      "Seu perfil não vê os lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const lotes = await listarResumoLotes(imob, {
      limite: 30,
      status: data.status,
      busca: data.busca,
      pagina: data.pagina,
    });
    return {
      lotes,
      podeCriar: await temPermissao(ctx(context), "regua_lote_criar"),
      podeAcionar: await temPermissao(ctx(context), "regua_lote_acionar"),
    };
  });

// ================================================================ Detalhe do lote (RF-08) e trilha

export interface LinhaDetalhe {
  id: string;
  cliente: string;
  documento: string;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null;
  diasAtraso: number | null;
  valor: number | null;
  status: StatusBoleto;
  pdf: "gerado" | "removido" | null;
  whatsapp: { status: StatusTentativa; tentativaId: string; erro: string | null } | null;
  email: { status: StatusTentativa; tentativaId: string; erro: string | null } | null;
}

export interface DetalheLote {
  lote: ResumoLote & {
    observacao: string | null;
    justificativa: string | null;
    periodo: string | null;
    filtros: {
      empreendimentos: string[];
      unidades: string[];
      campos: { campo: string; op: string; valor?: string; valor2?: string }[];
      diasMin: number | null;
      diasMax: number | null;
    };
    templateWhatsapp: string | null;
    templateEmail: string | null;
    canceladoEm: string | null;
  };
  contadores: Contadores;
  linhas: LinhaDetalhe[];
  total: number;
  porPagina: number;
  podeAcionar: boolean;
}

export const detalheLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        loteId: uuid,
        filtro: z.enum(["todos", "sucesso", "falhas", "excecoes", "andamento"]).default("todos"),
        busca: z.string().trim().max(80).nullable().optional(),
        pagina: z.number().int().min(0).max(1000).default(0),
      }),
    ),
  )
  .handler(async ({ data, context }): Promise<DetalheLote> => {
    await exigirAlguma(
      ctx(context),
      ["regua_auditoria_ver", "regua_lote_criar"],
      "Seu perfil não vê os lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mascararDocumento } = await import("./comum");
    const { data: l } = await supabaseAdmin
      .from("regua_lote")
      .select("*")
      .eq("id", data.loteId)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!l) throw new Error("Lote não encontrado.");
    const nomes = new Map<string, string>();
    const ids = [l.template_whatsapp_id, l.template_email_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: ts } = await supabaseAdmin
        .from("regua_template")
        .select("id, nome")
        .in("id", ids);
      for (const t of ts ?? []) nomes.set(t.id, t.nome);
    }
    const porPagina = 50;
    let q = supabaseAdmin
      .from("regua_boleto")
      .select(
        "id, cliente_nome, cpf_cnpj, empreendimento, unidade, numero, vencimento, dias_atraso, valor, status_geral",
        { count: "exact" },
      )
      .eq("lote_id", l.id)
      .neq("status_geral", "excluido")
      .order("cliente_nome")
      .range(data.pagina * porPagina, data.pagina * porPagina + porPagina - 1);
    if (data.filtro === "sucesso") q = q.in("status_geral", ["sucesso", "parcial"]);
    if (data.filtro === "falhas") q = q.in("status_geral", ["falha", "parcial"]);
    if (data.filtro === "excecoes")
      q = q.in("status_geral", ["excecao_registro", "excecao_contato"]);
    if (data.filtro === "andamento")
      q = q.in("status_geral", ["processando", "elegivel", "pendente"]);
    if (data.busca) {
      const b = data.busca.replace(/[%,()]/g, "");
      q = q.or(`cliente_nome.ilike.%${b}%,numero.ilike.%${b}%`);
    }
    const { data: bols, count } = await q;
    const bIds = (bols ?? []).map((b) => b.id);
    const [{ data: tents }, { data: docs }] = await Promise.all([
      bIds.length
        ? supabaseAdmin
            .from("regua_tentativa")
            .select("id, boleto_id, canal, status, erro, criado_em")
            .in("boleto_id", bIds)
            .neq("status", "cancelado")
            .order("criado_em", { ascending: false })
        : Promise.resolve({
            data: [] as {
              id: string;
              boleto_id: string;
              canal: string;
              status: string;
              erro: string | null;
              criado_em: string;
            }[],
          }),
      bIds.length
        ? supabaseAdmin
            .from("regua_documento")
            .select("boleto_id, removido_em")
            .in("boleto_id", bIds)
        : Promise.resolve({ data: [] as { boleto_id: string; removido_em: string | null }[] }),
    ]);
    const ultima = new Map<
      string,
      { status: StatusTentativa; tentativaId: string; erro: string | null }
    >();
    for (const t of tents ?? []) {
      const k = `${t.boleto_id}:${t.canal}`;
      if (!ultima.has(k))
        ultima.set(k, { status: t.status as StatusTentativa, tentativaId: t.id, erro: t.erro });
    }
    const docPor = new Map(
      (docs ?? []).map((d) => [
        d.boleto_id,
        d.removido_em ? ("removido" as const) : ("gerado" as const),
      ]),
    );
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: l.id });
    return {
      lote: {
        id: l.id,
        numero: Number(l.numero),
        titulo: l.titulo,
        tipoRegua: l.tipo_regua as "a_vencer" | "atraso",
        faixa: l.faixa_atraso,
        origem: l.origem as "rm" | "planilha",
        tipo: l.tipo as "normal" | "extraordinario",
        status: l.status as StatusLote,
        usuario: l.usuario_nome,
        criadoEm: l.criado_em,
        iniciadoEm: l.iniciado_em,
        finalizadoEm: l.finalizado_em,
        canais: l.canais as Canal[],
        contadores: (l.contadores ?? {}) as Partial<Contadores>,
        observacao: l.observacao,
        justificativa: l.justificativa,
        periodo: l.periodo_vencimento as string | null,
        filtros: {
          empreendimentos: (
            (l.filtros as { empreendimentos?: string[] } | null)?.empreendimentos ?? []
          ).map(String),
          unidades: ((l.filtros as { unidades?: string[] } | null)?.unidades ?? []).map(String),
          campos: (
            ((l.filtros as { campos?: unknown[] } | null)?.campos ?? []) as {
              campo: string;
              op: string;
              valor?: string;
              valor2?: string;
            }[]
          ).map((f) => ({
            campo: String(f.campo),
            op: String(f.op),
            valor: f.valor,
            valor2: f.valor2,
          })),
          diasMin: (l.filtros as { dias_min?: number } | null)?.dias_min ?? null,
          diasMax: (l.filtros as { dias_max?: number | null } | null)?.dias_max ?? null,
        },
        templateWhatsapp: l.template_whatsapp_id
          ? (nomes.get(l.template_whatsapp_id) ?? null)
          : null,
        templateEmail: l.template_email_id ? (nomes.get(l.template_email_id) ?? null) : null,
        canceladoEm: l.cancelado_em,
      },
      contadores: cont as unknown as Contadores,
      linhas: (bols ?? []).map((b) => ({
        id: b.id,
        cliente: b.cliente_nome,
        documento: mascararDocumento(b.cpf_cnpj),
        empreendimento: b.empreendimento,
        unidade: b.unidade,
        numero: b.numero,
        vencimento: b.vencimento,
        diasAtraso: b.dias_atraso,
        valor: b.valor != null ? Number(b.valor) : null,
        status: b.status_geral as StatusBoleto,
        pdf: docPor.get(b.id) ?? null,
        whatsapp: ultima.get(`${b.id}:whatsapp`) ?? null,
        email: ultima.get(`${b.id}:email`) ?? null,
      })),
      total: count ?? 0,
      porPagina,
      podeAcionar: await temPermissao(ctx(context), "regua_lote_acionar"),
    };
  });

export interface EventoTrilha {
  em: string | null;
  titulo: string;
  detalhe: string | null;
  tipo: "ok" | "falha" | "info" | "aviso";
  tentativaId?: string;
  canal?: Canal;
  payload?: string | null;
  resposta?: string | null;
}

export const trilhaBoleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ boletoId: uuid })))
  .handler(async ({ data, context }) => {
    await exigirAlguma(
      ctx(context),
      ["regua_auditoria_ver", "regua_lote_criar"],
      "Seu perfil não vê os lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const comum = await import("./comum");
    const { data: b } = await supabaseAdmin
      .from("regua_boleto")
      .select("*")
      .eq("id", data.boletoId)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!b) throw new Error("Boleto não encontrado.");
    const [{ data: lote }, { data: contatos }, { data: doc }, { data: tents }] = await Promise.all([
      supabaseAdmin
        .from("regua_lote")
        .select("origem, titulo, numero")
        .eq("id", b.lote_id)
        .single(),
      supabaseAdmin
        .from("regua_contato")
        .select("canal, status_validacao, validado_em")
        .eq("boleto_id", b.id),
      supabaseAdmin
        .from("regua_documento")
        .select("criado_em, expira_em, removido_em")
        .eq("boleto_id", b.id)
        .maybeSingle(),
      supabaseAdmin.from("regua_tentativa").select("*").eq("boleto_id", b.id).order("criado_em"),
    ]);
    const ev: EventoTrilha[] = [];
    ev.push({
      em: b.criado_em,
      titulo: lote?.origem === "rm" ? "Consultado no TOTVS RM" : "Lido da planilha",
      detalhe: `Lote #${lote?.numero} · ${lote?.titulo}`,
      tipo: "ok",
    });
    ev.push({
      em: b.criado_em,
      titulo: `Registro no banco: ${comum.ROTULO_REGISTRO[b.status_registro_banco as StatusRegistro]}`,
      detalhe:
        b.status_registro_banco === "nao_verificado"
          ? "A origem não informou o registro; o boleto seguiu para o envio."
          : null,
      tipo:
        b.status_registro_banco === "registrado"
          ? "ok"
          : b.status_registro_banco === "nao_verificado"
            ? "aviso"
            : "falha",
    });
    for (const c of contatos ?? []) {
      ev.push({
        em: c.validado_em,
        titulo: `${c.canal === "whatsapp" ? "WhatsApp" : "E-mail"}: ${comum.ROTULO_CONTATO[c.status_validacao as StatusContato]}`,
        detalhe: null,
        tipo: c.status_validacao === "valido" ? "ok" : "falha",
      });
    }
    if (doc) {
      ev.push({
        em: doc.criado_em,
        titulo: "PDF gerado com senha",
        detalhe: `Link válido até ${comum.dataHoraBr(doc.expira_em)}`,
        tipo: "ok",
      });
      if (doc.removido_em)
        ev.push({
          em: doc.removido_em,
          titulo: "PDF removido (prazo vencido)",
          detalhe: null,
          tipo: "info",
        });
    }
    for (const t of tents ?? []) {
      const canal = t.canal === "whatsapp" ? "WhatsApp" : "E-mail";
      ev.push({
        em: t.tentado_em ?? t.criado_em,
        titulo: `${canal} — ${comum.ROTULO_TENTATIVA[t.status as StatusTentativa]}`,
        detalhe:
          [t.provedor, t.id_provedor ? `id ${t.id_provedor}` : null, t.erro]
            .filter(Boolean)
            .join(" · ") || null,
        tipo: ["enviado", "entregue", "lido"].includes(t.status)
          ? "ok"
          : t.status === "falha" || t.status === "bloqueado_24h"
            ? "falha"
            : "info",
        tentativaId: t.id,
        canal: t.canal as Canal,
        payload: t.payload != null ? JSON.stringify(t.payload, null, 2).slice(0, 4000) : null,
        resposta: t.resposta != null ? JSON.stringify(t.resposta, null, 2).slice(0, 4000) : null,
      });
      if (t.entregue_em && t.status !== "entregue")
        ev.push({ em: t.entregue_em, titulo: `${canal} entregue`, detalhe: null, tipo: "ok" });
    }
    ev.sort((a, z) => (a.em ?? "").localeCompare(z.em ?? ""));
    return {
      boleto: {
        cliente: b.cliente_nome,
        documento: comum.mascararDocumento(b.cpf_cnpj),
        numero: b.numero,
        unidade: b.unidade,
        empreendimento: b.empreendimento,
        valor: b.valor != null ? Number(b.valor) : null,
        status: b.status_geral as StatusBoleto,
      },
      eventos: ev,
    };
  });

/** Linhas para o relatório (Excel/PDF gerados no navegador). CPF/CNPJ mascarado. */
export const dadosExportacaoLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ loteId: uuid })))
  .handler(async ({ data, context }) => {
    await exigirAlguma(
      ctx(context),
      ["regua_auditoria_ver", "regua_lote_criar"],
      "Seu perfil não vê os lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const comum = await import("./comum");
    const { auditar } = await import("@/lib/auditoria.server");
    const { data: l } = await supabaseAdmin
      .from("regua_lote")
      .select("*")
      .eq("id", data.loteId)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!l) throw new Error("Lote não encontrado.");
    const bols: Record<string, unknown>[] = [];
    for (let de = 0; ; de += 1000) {
      const { data: parte } = await supabaseAdmin
        .from("regua_boleto")
        .select(
          "id, cliente_nome, cpf_cnpj, empreendimento, unidade, numero, vencimento, dias_atraso, valor, status_registro_banco, status_geral",
        )
        .eq("lote_id", l.id)
        .order("cliente_nome")
        .range(de, de + 999);
      bols.push(...(parte ?? []));
      if (!parte || parte.length < 1000) break;
    }
    const tents: {
      boleto_id: string;
      canal: string;
      status: string;
      erro: string | null;
      tentado_em: string | null;
      criado_em: string;
    }[] = [];
    for (let de = 0; ; de += 1000) {
      const { data: parte } = await supabaseAdmin
        .from("regua_tentativa")
        .select("boleto_id, canal, status, erro, tentado_em, criado_em")
        .eq("lote_id", l.id)
        .neq("status", "cancelado")
        .order("criado_em", { ascending: false })
        .range(de, de + 999);
      tents.push(...(parte ?? []));
      if (!parte || parte.length < 1000) break;
    }
    const ultima = new Map<string, (typeof tents)[number]>();
    for (const t of tents)
      if (!ultima.has(`${t.boleto_id}:${t.canal}`)) ultima.set(`${t.boleto_id}:${t.canal}`, t);
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: l.id });
    await auditar({
      userId: ctx(context).userId,
      acao: "regua_lote_exportado",
      entidade: "regua_lote",
      entidadeId: l.id,
      detalhes: { titulo: l.titulo, numero: l.numero },
    });
    return {
      lote: {
        numero: Number(l.numero),
        titulo: l.titulo,
        status: l.status as StatusLote,
        usuario: l.usuario_nome,
        iniciadoEm: l.iniciado_em,
        finalizadoEm: l.finalizado_em,
        origem: l.origem,
        tipoRegua: l.tipo_regua,
        faixa: l.faixa_atraso,
        tipo: l.tipo,
      },
      contadores: cont as unknown as Contadores,
      linhas: bols.map((b) => {
        const w = ultima.get(`${b.id}:whatsapp`);
        const e = ultima.get(`${b.id}:email`);
        return {
          cliente: String(b.cliente_nome),
          documento: comum.mascararDocumento(b.cpf_cnpj as string | null),
          empreendimento: (b.empreendimento as string | null) ?? "",
          unidade: (b.unidade as string | null) ?? "",
          boleto: String(b.numero),
          vencimento: comum.dataBr(b.vencimento as string | null),
          diasAtraso: (b.dias_atraso as number | null) ?? null,
          valor: b.valor != null ? Number(b.valor) : null,
          registro: comum.ROTULO_REGISTRO[b.status_registro_banco as StatusRegistro],
          whatsapp: w ? comum.ROTULO_TENTATIVA[w.status as StatusTentativa] : "—",
          whatsappErro: w?.erro ?? "",
          email: e ? comum.ROTULO_TENTATIVA[e.status as StatusTentativa] : "—",
          emailErro: e?.erro ?? "",
          resultado: comum.ROTULO_BOLETO[b.status_geral as StatusBoleto],
        };
      }),
    };
  });
