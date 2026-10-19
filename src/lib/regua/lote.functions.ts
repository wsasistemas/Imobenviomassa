import { createServerFn } from "@tanstack/react-start";
import { aplicarFiltrosCampos, type CampoOrigem, type FiltroCampo } from "./comum";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  exigirPermissao,
  imobiliariaDoContexto,
  temPermissao,
  type ContextoAutenticado,
} from "@/lib/authz";
import type {
  Canal,
  FaixaAtraso,
  StatusBoleto,
  StatusContato,
  StatusLote,
  StatusRegistro,
  TipoRegua,
} from "./comum";

// Régua de Cobrança — ciclo do lote (PRD 4 e 5.1). O envio segue o padrão do Disparo DocuSign deste app: o
// navegador chama `processarLote` em sequência enquanto a tela de andamento está aberta (cada chamada envia
// poucas mensagens, respeitando o intervalo do WhatsApp). Fechou a aba: o lote fica "Em processamento" e
// continua de onde parou ao abrir o lote de novo. Tudo idempotente: só sai o que está "pendente".

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

const ctx = (c: unknown) => c as ContextoAutenticado;
const uuid = z.string().uuid("Identificador inválido.");
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const POR_PAGINA = 50;

async function nomeDoUsuario(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("usuarios")
    .select("nome, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.nome || data?.email || "—";
}

async function loteDaImobiliaria(imob: string, loteId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("regua_lote")
    .select("*")
    .eq("id", loteId)
    .eq("imobiliaria_id", imob)
    .maybeSingle();
  if (!data) throw new Error("Lote não encontrado.");
  return data;
}

function mascararTelefone(t: string | null): string {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 8) return "—";
  return `(${d.slice(0, 2)}) ${d.length === 11 ? d.slice(2, 3) : ""}****-${d.slice(-4)}`;
}

function mascararEmail(e: string | null): string {
  if (!e || !e.includes("@")) return "—";
  const [u, dom] = e.split("@");
  return `${u.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(6, u.length - 1)))}@${dom}`;
}

// ---------------------------------------------------------------- 1) preparar (passos 1 a 4)

const filtroCampoSchema = z.object({
  campo: z.string().trim().min(1, "Escolha o campo do filtro.").max(80),
  op: z.enum([
    "igual",
    "diferente",
    "contem",
    "nao_contem",
    "maior",
    "menor",
    "entre",
    "vazio",
    "preenchido",
  ]),
  valor: z.string().max(200).optional(),
  valor2: z.string().max(200).optional(),
});

const prepararSchema = z
  .object({
    loteId: uuid.optional(),
    titulo: z
      .string({ required_error: "Informe o título da remessa." })
      .trim()
      .min(3, "Informe o título da remessa.")
      .max(140, "Título muito longo."),
    observacao: z.string().trim().max(300).nullable().optional(),
    origem: z.enum(["rm", "planilha"]),
    tipoRegua: z.enum(["a_vencer", "atraso"]),
    faixa: z.enum(["30", "60", "90", "90+", "personalizada"]).nullable().optional(),
    diasMin: z.number().int().min(0).max(99999).nullable().optional(),
    diasMax: z.number().int().min(0).max(99999).nullable().optional(),
    filtrosCampos: z
      .array(filtroCampoSchema)
      .max(20, "No máximo 20 filtros por campo.")
      .default([]),
    vencimentoDe: dataIso.nullable().optional(),
    vencimentoAte: dataIso.nullable().optional(),
    empreendimentos: z.array(z.string().trim().max(120)).max(200).default([]),
    unidades: z.array(z.string().trim().max(60)).max(500).default([]),
    canais: z
      .array(z.enum(["whatsapp", "email"]))
      .min(1, "Escolha ao menos um canal.")
      .max(2),
    templateWhatsappId: uuid.nullable().optional(),
    templateEmailId: uuid.nullable().optional(),
    linhas: z
      .array(z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.null()])))
      .max(2000, "A planilha passa de 2.000 linhas.")
      .optional(),
  })
  .superRefine((v, c) => {
    if (v.tipoRegua === "atraso" && !v.faixa)
      c.addIssue({ code: "custom", message: "Escolha a faixa de atraso." });
    if (v.tipoRegua === "atraso" && v.faixa === "personalizada") {
      if (v.diasMin == null)
        c.addIssue({ code: "custom", message: "Informe a partir de quantos dias de atraso." });
      else if (v.diasMax != null && v.diasMax < v.diasMin)
        c.addIssue({
          code: "custom",
          message: "Na faixa personalizada, o máximo de dias precisa ser maior que o mínimo.",
        });
    }
    if (v.tipoRegua === "a_vencer" && (!v.vencimentoDe || !v.vencimentoAte))
      c.addIssue({ code: "custom", message: "Informe o período de vencimento." });
    if (v.canais.includes("whatsapp") && !v.templateWhatsappId)
      c.addIssue({ code: "custom", message: "Escolha o template de WhatsApp." });
    if (v.canais.includes("email") && !v.templateEmailId)
      c.addIssue({ code: "custom", message: "Escolha o template de e-mail." });
    if (v.origem === "planilha" && !v.linhas?.length)
      c.addIssue({ code: "custom", message: "Envie a planilha com os boletos." });
  });

export interface ResultadoPreparo {
  loteId: string;
  contadores: Contadores;
  ignoradas: { linha: number; motivo: string }[];
  limiteAtingido: boolean;
}

export interface Contadores {
  no_lote: number;
  excluidos: number;
  nao_registrados: number;
  sem_contato: number;
  elegiveis: number;
  sucesso: number;
  parcial: number;
  falhas: number;
  processando: number;
  whatsapp: {
    enviados: number;
    entregues: number;
    lidos?: number;
    falhas: number;
    bloqueados: number;
    fila: number;
  };
  email: { enviados: number; entregues: number; falhas: number; bloqueados: number; fila: number };
}

function statusInicial(
  registro: StatusRegistro,
  contatos: Partial<Record<Canal, StatusContato>>,
  canais: Canal[],
): StatusBoleto {
  if (registro === "nao_registrado" || registro === "erro") return "excecao_registro";
  return canais.some((c) => contatos[c] === "valido") ? "elegivel" : "excecao_contato";
}

export const prepararLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(prepararSchema))
  .handler(async ({ data, context }): Promise<ResultadoPreparo> => {
    await exigirPermissao(ctx(context), "regua_lote_criar", "Seu perfil não monta lotes da régua.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origem = await import("./origem.server");
    const envio = await import("./envio.server");
    const { statusContato } = await import("./comum");

    // Templates escolhidos precisam estar prontos (D8): a mensagem de cada cliente sai deles.
    if (data.canais.includes("whatsapp"))
      await envio.carregarTemplateWhatsapp(imob, data.templateWhatsappId!);
    if (data.canais.includes("email"))
      await envio.carregarTemplateEmail(imob, data.templateEmailId!);

    const filtro = {
      tipoRegua: data.tipoRegua as TipoRegua,
      faixa: (data.faixa ?? null) as FaixaAtraso | null,
      vencimentoDe: data.vencimentoDe ?? null,
      vencimentoAte: data.vencimentoAte ?? null,
      empreendimentos: data.empreendimentos,
      unidades: data.unidades,
      diasMin: data.diasMin ?? null,
      diasMax: data.diasMax ?? null,
    };
    const todasBrutas =
      data.origem === "rm"
        ? await origem.buscarNoRm(imob, filtro)
        : (data.linhas as Record<string, unknown>[]);
    // Filtros por campo montados pelo usuário valem sobre as colunas da origem (TOTVS RM ou planilha).
    const brutas = aplicarFiltrosCampos(todasBrutas, data.filtrosCampos as FiltroCampo[]);
    const { boletos: normalizados, ignoradas } = origem.normalizarLinhas(brutas);
    const filtrados = origem.filtrar(normalizados, filtro);
    const limiteAtingido = filtrados.length > origem.LIMITE_BOLETOS;
    const boletos = filtrados.slice(0, origem.LIMITE_BOLETOS);

    const linhaLote = {
      imobiliaria_id: imob,
      titulo: data.titulo,
      observacao: data.observacao ?? null,
      origem: data.origem,
      tipo_regua: data.tipoRegua,
      faixa_atraso: data.tipoRegua === "atraso" ? (data.faixa ?? null) : null,
      periodo_vencimento:
        data.tipoRegua === "a_vencer" ? `[${data.vencimentoDe},${data.vencimentoAte}]` : null,
      filtros: {
        empreendimentos: data.empreendimentos,
        unidades: data.unidades,
        campos: data.filtrosCampos,
        ...(data.faixa === "personalizada"
          ? { dias_min: data.diasMin ?? 1, dias_max: data.diasMax ?? null }
          : {}),
        da_origem: todasBrutas.length,
        ignoradas: ignoradas.length,
      },
      canais: data.canais,
      template_whatsapp_id: data.canais.includes("whatsapp")
        ? (data.templateWhatsappId ?? null)
        : null,
      template_email_id: data.canais.includes("email") ? (data.templateEmailId ?? null) : null,
      usuario_id: ctx(context).userId,
      usuario_nome: await nomeDoUsuario(ctx(context).userId),
    };

    let loteId = data.loteId ?? null;
    if (loteId) {
      const atual = await loteDaImobiliaria(imob, loteId);
      if (atual.status !== "rascunho")
        throw new Error("Só um lote em rascunho pode ser montado de novo.");
      await supabaseAdmin.from("regua_boleto").delete().eq("lote_id", loteId);
      const { error } = await supabaseAdmin.from("regua_lote").update(linhaLote).eq("id", loteId);
      if (error) throw new Error("Não foi possível atualizar o rascunho.");
    } else {
      const { data: novo, error } = await supabaseAdmin
        .from("regua_lote")
        .insert(linhaLote)
        .select("id")
        .single();
      if (error || !novo) {
        const { erroGenerico } = await import("@/lib/erros.server");
        throw erroGenerico("regua.prepararLote", error, "Não foi possível criar o lote.");
      }
      loteId = novo.id;
    }

    const canais = data.canais as Canal[];
    for (let i = 0; i < boletos.length; i += 500) {
      const parte = boletos.slice(i, i + 500);
      const contatosPorBoleto = parte.map((b) => ({
        whatsapp: canais.includes("whatsapp") ? statusContato("whatsapp", b.telefone) : undefined,
        email: canais.includes("email") ? statusContato("email", b.email) : undefined,
      }));
      const { data: inseridos, error } = await supabaseAdmin
        .from("regua_boleto")
        .insert(
          parte.map((b, k) => ({
            imobiliaria_id: imob,
            lote_id: loteId!,
            cliente_codigo: b.cliente_codigo,
            cliente_nome: b.cliente_nome,
            cpf_cnpj: b.cpf_cnpj,
            empreendimento: b.empreendimento,
            unidade: b.unidade,
            numero: b.numero,
            vencimento: b.vencimento,
            dias_atraso: b.dias_atraso,
            valor: b.valor,
            linha_digitavel: b.linha_digitavel,
            status_registro_banco: b.status_registro_banco,
            status_geral: statusInicial(b.status_registro_banco, contatosPorBoleto[k], canais),
            dados: b.dados,
          })),
        )
        .select("id, numero");
      if (error || !inseridos) {
        const { erroGenerico } = await import("@/lib/erros.server");
        throw erroGenerico(
          "regua.prepararLote.boletos",
          error,
          "Não foi possível gravar os boletos do lote.",
        );
      }
      const idPorNumero = new Map(inseridos.map((x) => [x.numero, x.id]));
      const contatos = parte.flatMap((b, k) =>
        canais.map((canal) => ({
          imobiliaria_id: imob,
          boleto_id: idPorNumero.get(b.numero)!,
          canal,
          valor: canal === "whatsapp" ? b.telefone : b.email,
          status_validacao: contatosPorBoleto[k][canal]!,
        })),
      );
      if (contatos.length) await supabaseAdmin.from("regua_contato").insert(contatos);
    }

    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: loteId! });
    await supabaseAdmin
      .from("regua_lote")
      .update({ contadores: cont as never })
      .eq("id", loteId!);
    return {
      loteId: loteId!,
      contadores: cont as unknown as Contadores,
      ignoradas: ignoradas.slice(0, 50),
      limiteAtingido,
    };
  });

// ---------------------------------------------------------------- 1b) campos da origem (filtros montados pelo usuário)

/**
 * Lê uma amostra da API do TOTVS RM (com o tipo de régua e a faixa escolhidos) e devolve as colunas que ela traz,
 * com o tipo provável e exemplos de valor. Colunas de dado pessoal vêm sem exemplos (LGPD).
 */
export const camposDaOrigemRm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        tipoRegua: z.enum(["a_vencer", "atraso"]),
        faixa: z.enum(["30", "60", "90", "90+", "personalizada"]).nullable().optional(),
        diasMin: z.number().int().min(0).max(99999).nullable().optional(),
        diasMax: z.number().int().min(0).max(99999).nullable().optional(),
        vencimentoDe: dataIso.nullable().optional(),
        vencimentoAte: dataIso.nullable().optional(),
      }),
    ),
  )
  .handler(async ({ data, context }): Promise<{ campos: CampoOrigem[]; total: number }> => {
    await exigirPermissao(ctx(context), "regua_lote_criar", "Seu perfil não monta lotes da régua.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const origem = await import("./origem.server");
    const { camposDeLinhas } = await import("./comum");
    const linhas = await origem.buscarNoRm(imob, {
      tipoRegua: data.tipoRegua as TipoRegua,
      faixa: (data.faixa ?? null) as FaixaAtraso | null,
      vencimentoDe: data.vencimentoDe ?? null,
      vencimentoAte: data.vencimentoAte ?? null,
      empreendimentos: [],
      unidades: [],
      diasMin: data.diasMin ?? null,
      diasMax: data.diasMax ?? null,
    });
    return { campos: camposDeLinhas(linhas), total: linhas.length };
  });

// ---------------------------------------------------------------- 2) pré-visualização

export interface LinhaPrevia {
  id: string;
  cliente: string;
  documento: string;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null;
  diasAtraso: number | null;
  valor: number | null;
  registro: StatusRegistro;
  whatsapp: StatusContato | null;
  email: StatusContato | null;
  status: StatusBoleto;
  incluido: boolean;
}

export const listarPrevia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z.object({
        loteId: uuid,
        filtro: z.enum(["todos", "elegiveis", "excecoes", "excluidos"]).default("todos"),
        busca: z.string().trim().max(80).optional(),
        pagina: z.number().int().min(0).max(1000).default(0),
      }),
    ),
  )
  .handler(async ({ data, context }) => {
    const pode =
      (await temPermissao(ctx(context), "regua_lote_criar")) ||
      (await temPermissao(ctx(context), "regua_auditoria_ver"));
    if (!pode) throw new Error("Seu perfil não vê os lotes da régua.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mascararDocumento } = await import("./comum");

    let q = supabaseAdmin
      .from("regua_boleto")
      .select(
        "id, cliente_nome, cpf_cnpj, empreendimento, unidade, numero, vencimento, dias_atraso, valor, status_registro_banco, status_geral, incluido",
        { count: "exact" },
      )
      .eq("lote_id", lote.id)
      .order("cliente_nome")
      .range(data.pagina * POR_PAGINA, data.pagina * POR_PAGINA + POR_PAGINA - 1);
    if (data.filtro === "elegiveis")
      q = q.not("status_geral", "in", "(excecao_registro,excecao_contato,excluido)");
    if (data.filtro === "excecoes")
      q = q.in("status_geral", ["excecao_registro", "excecao_contato"]);
    if (data.filtro === "excluidos") q = q.eq("status_geral", "excluido");
    if (data.busca)
      q = q.or(
        `cliente_nome.ilike.%${data.busca.replace(/[%,()]/g, "")}%,numero.ilike.%${data.busca.replace(/[%,()]/g, "")}%`,
      );
    const { data: linhas, count } = await q;
    const ids = (linhas ?? []).map((l) => l.id);
    const { data: contatos } = ids.length
      ? await supabaseAdmin
          .from("regua_contato")
          .select("boleto_id, canal, status_validacao")
          .in("boleto_id", ids)
      : { data: [] as { boleto_id: string; canal: string; status_validacao: string }[] };
    const st = new Map(
      (contatos ?? []).map((c) => [
        `${c.boleto_id}:${c.canal}`,
        c.status_validacao as StatusContato,
      ]),
    );
    return {
      total: count ?? 0,
      porPagina: POR_PAGINA,
      contadores: (await supabaseAdmin.rpc("regua_contadores", { p_lote: lote.id }))
        .data as unknown as Contadores,
      lote: {
        id: lote.id,
        numero: lote.numero,
        titulo: lote.titulo,
        status: lote.status as StatusLote,
        canais: lote.canais as Canal[],
      },
      linhas: (linhas ?? []).map((l): LinhaPrevia => ({
        id: l.id,
        cliente: l.cliente_nome,
        documento: mascararDocumento(l.cpf_cnpj),
        empreendimento: l.empreendimento,
        unidade: l.unidade,
        numero: l.numero,
        vencimento: l.vencimento,
        diasAtraso: l.dias_atraso,
        valor: l.valor != null ? Number(l.valor) : null,
        registro: l.status_registro_banco as StatusRegistro,
        whatsapp: st.get(`${l.id}:whatsapp`) ?? null,
        email: st.get(`${l.id}:email`) ?? null,
        status: l.status_geral as StatusBoleto,
        incluido: l.incluido,
      })),
    };
  });

export const alternarInclusao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(z.object({ loteId: uuid, ids: z.array(uuid).min(1).max(500), incluido: z.boolean() })),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissao(ctx(context), "regua_lote_criar", "Seu perfil não monta lotes da régua.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    if (lote.status !== "rascunho") throw new Error("O lote já foi acionado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bols } = await supabaseAdmin
      .from("regua_boleto")
      .select("id, status_registro_banco")
      .eq("lote_id", lote.id)
      .in("id", data.ids);
    const { data: contatos } = await supabaseAdmin
      .from("regua_contato")
      .select("boleto_id, canal, status_validacao")
      .in("boleto_id", data.ids);
    for (const b of bols ?? []) {
      let status: StatusBoleto = "excluido";
      if (data.incluido) {
        const cs: Partial<Record<Canal, StatusContato>> = {};
        for (const c of (contatos ?? []).filter((x) => x.boleto_id === b.id))
          cs[c.canal as Canal] = c.status_validacao as StatusContato;
        status = statusInicial(
          b.status_registro_banco as StatusRegistro,
          cs,
          lote.canais as Canal[],
        );
      }
      await supabaseAdmin
        .from("regua_boleto")
        .update({ incluido: data.incluido, status_geral: status })
        .eq("id", b.id);
    }
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: lote.id });
    await supabaseAdmin
      .from("regua_lote")
      .update({ contadores: cont as never })
      .eq("id", lote.id);
    return { contadores: cont as unknown as Contadores };
  });

export interface PreviaMensagem {
  cliente: string;
  whatsapp: {
    para: string;
    remetente: string | null;
    template: string;
    texto: string;
    documento: string | null;
  } | null;
  email: {
    de: string;
    para: string;
    assunto: string;
    texto: string;
    anexo: string | null;
    template: string;
  } | null;
  avisos: string[];
}

/** Mensagem montada de um cliente com os templates escolhidos (D9). Só os canais que vão sair para ele. */
export const previaMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ loteId: uuid, boletoId: uuid })))
  .handler(async ({ data, context }): Promise<PreviaMensagem> => {
    const pode =
      (await temPermissao(ctx(context), "regua_lote_criar")) ||
      (await temPermissao(ctx(context), "regua_auditoria_ver"));
    if (!pode) throw new Error("Seu perfil não vê os lotes da régua.");
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const envio = await import("./envio.server");
    const comum = await import("./comum");
    const { data: b } = await supabaseAdmin
      .from("regua_boleto")
      .select("*")
      .eq("id", data.boletoId)
      .eq("lote_id", lote.id)
      .maybeSingle();
    if (!b) throw new Error("Boleto não encontrado.");
    const { data: contatos } = await supabaseAdmin
      .from("regua_contato")
      .select("canal, valor, status_validacao")
      .eq("boleto_id", b.id);
    const contato = (c: Canal) => (contatos ?? []).find((x) => x.canal === c);
    const { data: cfg } = await supabaseAdmin
      .from("regua_config")
      .select("texto_dica")
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    const dados = comum.dadosDaMensagem({
      ...b,
      valor: b.valor != null ? Number(b.valor) : null,
      link: "https://link-seguro-do-boleto (gerado no envio)",
      dica: cfg?.texto_dica ?? "",
    });
    const avisos: string[] = [];
    if (b.status_geral === "excecao_registro")
      avisos.push("Boleto não registrado no banco: fica fora do disparo.");
    if (b.status_geral === "excecao_contato")
      avisos.push("Cliente sem contato válido: fica fora do disparo.");
    if (b.status_geral === "excluido") avisos.push("Linha excluída manualmente deste lote.");
    if (!comum.senhaDoPdf("cpf_5_primeiros", b.cpf_cnpj))
      avisos.push("Sem CPF/CNPJ: não há como gerar o PDF com senha.");

    let whatsapp: PreviaMensagem["whatsapp"] = null;
    const cw = contato("whatsapp");
    if (lote.template_whatsapp_id && cw?.status_validacao === "valido") {
      try {
        const t = await envio.carregarTemplateWhatsapp(imob, lote.template_whatsapp_id);
        const m = comum.montarWhatsapp({ corpo: t.corpo, variaveis: t.variaveis }, t.mapa, dados);
        whatsapp = {
          para: mascararTelefone(cw.valor),
          remetente: t.remetente,
          template: t.nome,
          texto: m.texto,
          documento: t.usaDocumento ? `boleto-${b.numero}.pdf` : null,
        };
      } catch (e) {
        avisos.push(e instanceof Error ? e.message : "Template de WhatsApp indisponível.");
      }
    } else if (lote.canais.includes("whatsapp")) {
      avisos.push(
        `WhatsApp não sai para este cliente (${comum.ROTULO_CONTATO[(cw?.status_validacao ?? "nao_informado") as StatusContato].toLowerCase()}).`,
      );
    }

    let email: PreviaMensagem["email"] = null;
    const ce = contato("email");
    if (lote.template_email_id && ce?.status_validacao === "valido") {
      try {
        const t = await envio.carregarTemplateEmail(imob, lote.template_email_id);
        const { data: p } = await supabaseAdmin
          .from("email_provedor")
          .select("remetente_nome, remetente_email")
          .eq("imobiliaria_id", imob)
          .maybeSingle();
        email = {
          de: p?.remetente_email
            ? `${p.remetente_nome ?? ""} <${p.remetente_email}>`.trim()
            : "(remetente não configurado)",
          para: mascararEmail(ce.valor),
          assunto: comum.preencher(t.assunto, dados),
          texto: comum.preencher(t.corpo, dados),
          anexo: t.anexo === "pdf_link" ? `boleto-${b.numero}.pdf` : null,
          template: t.nome,
        };
      } catch (e) {
        avisos.push(e instanceof Error ? e.message : "Template de e-mail indisponível.");
      }
    } else if (lote.canais.includes("email")) {
      avisos.push(
        `E-mail não sai para este cliente (${comum.ROTULO_CONTATO[(ce?.status_validacao ?? "nao_informado") as StatusContato].toLowerCase()}).`,
      );
    }
    return { cliente: b.cliente_nome, whatsapp, email, avisos };
  });

// ---------------------------------------------------------------- 3) acionar (passo 5)

export interface ResumoAcionamento {
  boletos: number;
  whatsapp: number;
  email: number;
  bloqueados24h: number;
}

async function montarTentativas(
  imob: string,
  lote: { id: string; canais: string[] },
  extraordinario: boolean,
  apenasBoletos?: string[],
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const todos: { id: string; numero: string }[] = [];
  for (let de = 0; ; de += 1000) {
    let q = supabaseAdmin
      .from("regua_boleto")
      .select("id, numero")
      .eq("lote_id", lote.id)
      .eq("incluido", true)
      .not("status_geral", "in", "(excecao_registro,excecao_contato,excluido)")
      .range(de, de + 999);
    if (apenasBoletos) q = q.in("id", apenasBoletos);
    const { data } = await q;
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const ids = todos.map((b) => b.id);
  const validos = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabaseAdmin
      .from("regua_contato")
      .select("boleto_id, canal")
      .in("boleto_id", ids.slice(i, i + 500))
      .eq("status_validacao", "valido");
    for (const c of data ?? []) validos.add(`${c.boleto_id}:${c.canal}`);
  }
  const bloqueados = new Map<string, Set<string>>();
  if (!extraordinario) {
    for (const canal of lote.canais) {
      const s = new Set<string>();
      for (let i = 0; i < todos.length; i += 500) {
        const { data } = await supabaseAdmin.rpc("regua_numeros_enviados_24h", {
          p_imobiliaria: imob,
          p_numeros: todos.slice(i, i + 500).map((b) => b.numero),
          p_canal: canal,
        });
        for (const n of (data as string[] | null) ?? []) s.add(n);
      }
      bloqueados.set(canal, s);
    }
  }
  const linhas: {
    imobiliaria_id: string;
    lote_id: string;
    boleto_id: string;
    canal: string;
    status: string;
    erro: string | null;
  }[] = [];
  for (const b of todos) {
    for (const canal of lote.canais) {
      if (!validos.has(`${b.id}:${canal}`)) continue;
      const travado = bloqueados.get(canal)?.has(b.numero) ?? false;
      linhas.push({
        imobiliaria_id: imob,
        lote_id: lote.id,
        boleto_id: b.id,
        canal,
        status: travado ? "bloqueado_24h" : "pendente",
        erro: travado ? "Já enviado por este canal nas últimas 24 h." : null,
      });
    }
  }
  for (let i = 0; i < linhas.length; i += 1000) {
    const { error } = await supabaseAdmin.from("regua_tentativa").insert(linhas.slice(i, i + 1000));
    if (error) throw new Error("Não foi possível criar a fila de envio.");
  }
  // Boletos sem nenhuma tentativa pendente ficam com o status das tentativas (ex.: só trava 24 h → falha).
  await supabaseAdmin.rpc("regua_recalcular_lote", { p_lote: lote.id });
  return {
    boletos: todos.length,
    whatsapp: linhas.filter((l) => l.canal === "whatsapp" && l.status === "pendente").length,
    email: linhas.filter((l) => l.canal === "email" && l.status === "pendente").length,
    bloqueados24h: linhas.filter((l) => l.status === "bloqueado_24h").length,
  } satisfies ResumoAcionamento;
}

export const acionarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(
      z
        .object({
          loteId: uuid,
          extraordinario: z.boolean().default(false),
          justificativa: z.string().trim().max(500).nullable().optional(),
        })
        .refine(
          (v) => !v.extraordinario || (v.justificativa?.length ?? 0) >= 10,
          "Escreva a justificativa do disparo extraordinário (mín. 10 caracteres).",
        ),
    ),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_lote_acionar",
      "Seu perfil não aciona lotes da régua.",
    );
    if (data.extraordinario)
      await exigirPermissao(
        ctx(context),
        "regua_disparo_extraordinario",
        "Seu perfil não faz disparo extraordinário.",
      );
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    if (lote.status !== "rascunho") throw new Error("Este lote já foi acionado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const envio = await import("./envio.server");
    const { auditar } = await import("@/lib/auditoria.server");

    // Confere tudo antes de abrir a fila: templates prontos, token da Zenvia, provedor e domínio do e-mail.
    const c = await envio.contextoDoLote(imob, lote);
    if (lote.canais.includes("whatsapp") && !c.tokenZenvia)
      throw new Error("Cadastre o token da Zenvia em Integrações › Zenvia WhatsApp.");

    // Trava contra clique duplo: só um acionamento passa do rascunho.
    const { data: virou } = await supabaseAdmin
      .from("regua_lote")
      .update({
        status: "em_processamento",
        iniciado_em: new Date().toISOString(),
        tipo: data.extraordinario ? "extraordinario" : "normal",
        justificativa: data.extraordinario ? data.justificativa : null,
      })
      .eq("id", lote.id)
      .eq("status", "rascunho")
      .select("id");
    if (!virou?.length) throw new Error("Este lote já foi acionado.");

    let resumo: ResumoAcionamento;
    try {
      resumo = await montarTentativas(imob, lote, data.extraordinario);
    } catch (e) {
      await supabaseAdmin
        .from("regua_lote")
        .update({ status: "rascunho", iniciado_em: null })
        .eq("id", lote.id);
      throw e;
    }
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: lote.id });
    await supabaseAdmin
      .from("regua_lote")
      .update({ contadores: cont as never })
      .eq("id", lote.id);
    await auditar({
      userId: ctx(context).userId,
      acao: data.extraordinario ? "regua_lote_acionado_extraordinario" : "regua_lote_acionado",
      entidade: "regua_lote",
      entidadeId: lote.id,
      detalhes: {
        titulo: lote.titulo,
        numero: lote.numero,
        ...resumo,
        justificativa: data.extraordinario ? data.justificativa : null,
      },
    });
    if (resumo.whatsapp + resumo.email === 0) await finalizarSeTerminou(imob, lote.id);
    return resumo;
  });

// ---------------------------------------------------------------- 4) processar (chamado em sequência pela tela)

const cacheContexto = new Map<
  string,
  { em: number; valor: Promise<import("./envio.server").ContextoEnvio> }
>();

async function finalizarSeTerminou(imob: string, loteId: string): Promise<StatusLote | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("regua_tentativa")
    .select("id", { count: "exact", head: true })
    .eq("lote_id", loteId)
    .in("status", ["pendente", "processando"]);
  const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: loteId });
  const c = cont as unknown as Contadores;
  if ((count ?? 0) > 0) {
    await supabaseAdmin
      .from("regua_lote")
      .update({ contadores: cont as never })
      .eq("id", loteId);
    return null;
  }
  const comFalhas =
    c.falhas > 0 ||
    c.parcial > 0 ||
    c.nao_registrados > 0 ||
    c.sem_contato > 0 ||
    c.whatsapp.bloqueados + c.email.bloqueados > 0;
  const status: StatusLote = comFalhas ? "concluido_com_falhas" : "concluido";
  await supabaseAdmin
    .from("regua_lote")
    .update({ status, finalizado_em: new Date().toISOString(), contadores: cont as never })
    .eq("id", loteId)
    .eq("imobiliaria_id", imob)
    .eq("status", "em_processamento");
  return status;
}

export const processarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ loteId: uuid })))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_lote_acionar",
      "Seu perfil não aciona lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (lote.status !== "em_processamento") {
      return {
        status: lote.status as StatusLote,
        enviados: 0,
        contadores: lote.contadores as unknown as Contadores,
        terminou: true,
      };
    }
    const envio = await import("./envio.server");
    await supabaseAdmin.rpc("regua_liberar_presas", { p_imobiliaria: imob, p_lote: lote.id });
    await envio.removerDocumentosVencidos(imob).catch(() => 0);

    const chave = `${imob}:${lote.id}`;
    let cache = cacheContexto.get(chave);
    if (!cache || Date.now() - cache.em > 60_000) {
      cache = { em: Date.now(), valor: envio.contextoDoLote(imob, lote) };
      cacheContexto.set(chave, cache);
    }
    let c: import("./envio.server").ContextoEnvio;
    try {
      c = await cache.valor;
    } catch (e) {
      cacheContexto.delete(chave);
      throw e;
    }

    // Lote pequeno por chamada: a função termina bem antes do limite da Vercel, mesmo com o intervalo do WhatsApp.
    const { data: reservadas } = await supabaseAdmin.rpc("regua_reservar_tentativas", {
      p_imobiliaria: imob,
      p_lote: lote.id,
      p_limite: 6,
    });
    const tentativas = (reservadas ?? []) as { id: string; canal: string; boleto_id: string }[];
    const ids = [...new Set(tentativas.map((t) => t.boleto_id))];
    const { data: contatos } = ids.length
      ? await supabaseAdmin
          .from("regua_contato")
          .select("boleto_id, canal, valor")
          .in("boleto_id", ids)
      : { data: [] as { boleto_id: string; canal: string; valor: string | null }[] };
    let enviados = 0;
    let ultimoWhats = 0;
    for (const t of tentativas) {
      if (t.canal === "whatsapp" && c.intervaloSeg > 0 && ultimoWhats) {
        const espera = c.intervaloSeg * 1000 - (Date.now() - ultimoWhats);
        if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      }
      const contato =
        (contatos ?? []).find((x) => x.boleto_id === t.boleto_id && x.canal === t.canal)?.valor ??
        null;
      const r = await envio.enviarTentativa(c, t, contato);
      if (t.canal === "whatsapp") ultimoWhats = Date.now();
      if (r.status === "enviado") enviados++;
    }
    const fim = await finalizarSeTerminou(imob, lote.id);
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: lote.id });
    if (fim) cacheContexto.delete(chave);
    return {
      status: (fim ?? "em_processamento") as StatusLote,
      enviados,
      contadores: cont as unknown as Contadores,
      terminou: !!fim,
    };
  });

export const cancelarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ loteId: uuid })))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_lote_acionar",
      "Seu perfil não cancela lotes da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    if (!["rascunho", "em_processamento"].includes(lote.status))
      throw new Error("Este lote já terminou.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");
    const { data: canceladas } = await supabaseAdmin
      .from("regua_tentativa")
      .update({ status: "cancelado" })
      .eq("lote_id", lote.id)
      .eq("status", "pendente")
      .select("boleto_id");
    if (canceladas?.length) await supabaseAdmin.rpc("regua_recalcular_lote", { p_lote: lote.id });
    const { data: cont } = await supabaseAdmin.rpc("regua_contadores", { p_lote: lote.id });
    await supabaseAdmin
      .from("regua_lote")
      .update({
        status: "cancelado",
        cancelado_em: new Date().toISOString(),
        finalizado_em: new Date().toISOString(),
        contadores: cont as never,
      })
      .eq("id", lote.id);
    await auditar({
      userId: ctx(context).userId,
      acao: "regua_lote_cancelado",
      entidade: "regua_lote",
      entidadeId: lote.id,
      detalhes: {
        titulo: lote.titulo,
        numero: lote.numero,
        status_anterior: lote.status,
        envios_cancelados: canceladas?.length ?? 0,
      },
    });
    return { ok: true };
  });

/** Reenvio (RF-08): uma tentativa com falha ou todas as falhas do lote. Volta o lote para a fila. */
export const reenviarFalhas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ loteId: uuid, tentativaId: uuid.optional() })))
  .handler(async ({ data, context }) => {
    await exigirPermissao(
      ctx(context),
      "regua_lote_acionar",
      "Seu perfil não reenvia mensagens da régua.",
    );
    const imob = await imobiliariaDoContexto(ctx(context));
    const lote = await loteDaImobiliaria(imob, data.loteId);
    if (lote.status === "rascunho" || lote.status === "cancelado")
      throw new Error("Só lotes acionados e não cancelados têm reenvio.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");

    // Por boleto e canal vale a tentativa mais recente; reenvia só se ela falhou.
    const { data: tents } = await supabaseAdmin
      .from("regua_tentativa")
      .select("id, boleto_id, canal, status, criado_em")
      .eq("lote_id", lote.id)
      .order("criado_em", { ascending: false });
    const ultima = new Map<
      string,
      { id: string; boleto_id: string; canal: string; status: string }
    >();
    for (const t of tents ?? [])
      if (!ultima.has(`${t.boleto_id}:${t.canal}`)) ultima.set(`${t.boleto_id}:${t.canal}`, t);
    const alvo = [...ultima.values()].filter(
      (t) => t.status === "falha" && (!data.tentativaId || t.id === data.tentativaId),
    );
    if (!alvo.length)
      throw new Error(
        data.tentativaId
          ? "Esta tentativa não é a última falha deste canal."
          : "Não há falhas para reenviar.",
      );
    const { error } = await supabaseAdmin.from("regua_tentativa").insert(
      alvo.map((t) => ({
        imobiliaria_id: imob,
        lote_id: lote.id,
        boleto_id: t.boleto_id,
        canal: t.canal,
        status: "pendente",
      })),
    );
    if (error) throw new Error("Não foi possível colocar o reenvio na fila.");
    for (const id of new Set(alvo.map((t) => t.boleto_id)))
      await supabaseAdmin.rpc("regua_recalcular_boleto", { p_boleto: id });
    await supabaseAdmin
      .from("regua_lote")
      .update({ status: "em_processamento", finalizado_em: null })
      .eq("id", lote.id);
    await auditar({
      userId: ctx(context).userId,
      acao: "regua_reenvio",
      entidade: "regua_lote",
      entidadeId: lote.id,
      detalhes: { titulo: lote.titulo, numero: lote.numero, reenvios: alvo.length },
    });
    return { reenvios: alvo.length };
  });
