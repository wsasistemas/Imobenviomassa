import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirAal2, exigirPapel, type ContextoAutenticado } from "@/lib/authz";
import { mascararDocumento } from "@/lib/csv";
import { mascararEmail, mascararTelefone } from "@/lib/mascaras";
import { ROTULO_TIPO_OPT_OUT, TIPOS_OPT_OUT, normalizarOptOut, type TipoOptOut } from "@/lib/optout";

// Administração › Privacidade (auditoria de segurança, Fase 4 / LGPD): direitos do titular, lista de
// descadastro (opt-out), anonimização e retenção.
//
//   · Tudo roda no servidor com a service_role (as tabelas wa_opt_outs / wa_retencao_config e as RPCs
//     wa_titular_ocorrencias / wa_anonimizar_* só aceitam service_role).
//   · Leitura e descadastro: Admin ou Super Admin. Anonimização e retenção (irreversíveis ou globais):
//     só Super Admin com a sessão em aal2 (2º fator).
//   · O navegador NUNCA recebe CPF/e-mail/telefone completos (só mascarados) e a trilha de auditoria
//     guarda apenas o tipo dos identificadores, nunca o valor.
//   · Erros de banco vão para o log do servidor; ao navegador vai uma mensagem genérica.

function validar<T extends z.ZodTypeAny>(schema: T, msgPadrao = "Dados inválidos.") {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? msgPadrao);
    return r.data;
  };
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type SupabaseAdmin = Awaited<ReturnType<typeof admin>>;

async function erroGenerico(origem: string, erro: unknown, mensagem: string): Promise<Error> {
  return (await import("@/lib/erros.server")).erroGenerico(origem, erro, mensagem);
}

async function gravarAuditoria(
  context: unknown,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhes: Record<string, unknown>,
) {
  const { auditar } = await import("@/lib/auditoria.server");
  await auditar({ userId: (context as ContextoAutenticado).userId, acao, entidade, entidadeId, detalhes });
}

async function exigirAdmin(context: unknown) {
  await exigirPapel(context as ContextoAutenticado, ["admin", "super_admin"], "Seu perfil não tem acesso à área de Privacidade.");
}

async function exigirSuperAdmin(context: unknown) {
  await exigirPapel(context as ContextoAutenticado, ["super_admin"], "Só um Super Admin pode executar esta operação.");
}

/** Super Admin com 2º fator: operações irreversíveis ou globais (anonimização, retenção). */
async function exigirSuperAdminComMfa(context: unknown) {
  await exigirSuperAdmin(context);
  await exigirAal2(context as ContextoAutenticado);
}

// ---------- Identificadores do titular ----------

type Identificadores = Partial<Record<TipoOptOut, string>>;

const identificador = (max: number) => z.string().trim().max(max, "Valor muito longo.").nullable().optional();

const titularSchema = z.object({
  cpf: identificador(30),
  email: identificador(254),
  telefone: identificador(30),
});

/** Normaliza o que foi preenchido (CPF/CNPJ, e-mail, telefone). Exige ao menos um e recusa valor inválido. */
function normalizarIdentificadores(d: { cpf?: string | null; email?: string | null; telefone?: string | null }): Identificadores {
  const out: Identificadores = {};
  for (const tipo of TIPOS_OPT_OUT) {
    const bruto = d[tipo]?.trim();
    if (!bruto) continue;
    const valor = normalizarOptOut(tipo, bruto);
    if (!valor) throw new Error(`${ROTULO_TIPO_OPT_OUT[tipo]} inválido.`);
    out[tipo] = valor;
  }
  if (!Object.keys(out).length) throw new Error("Informe ao menos um identificador do titular: CPF/CNPJ, e-mail ou telefone.");
  return out;
}

const tiposDe = (ids: Identificadores): TipoOptOut[] => TIPOS_OPT_OUT.filter((t) => ids[t]);

const paramsRpc = (ids: Identificadores) => ({
  p_cpf: ids.cpf ?? null,
  p_email: ids.email ?? null,
  p_telefone: ids.telefone ?? null,
});

function mascarar(tipo: TipoOptOut, valor: string): string {
  if (tipo === "cpf") return mascararDocumento(valor);
  if (tipo === "email") return mascararEmail(valor);
  return mascararTelefone(valor);
}

async function gravarOptOuts(sb: SupabaseAdmin, ids: Identificadores, origem: string, motivo: string | null, userId: string) {
  const linhas = tiposDe(ids).map((tipo) => ({ tipo, valor: ids[tipo]!, motivo, origem, criado_por: userId }));
  return sb.from("wa_opt_outs").upsert(linhas, { onConflict: "tipo,valor", ignoreDuplicates: true });
}

// ---------- Lista de descadastro (opt-out) ----------

export type OptOutLinha = {
  id: string;
  tipo: TipoOptOut;
  /** Nunca o valor completo. */
  valorMascarado: string;
  motivo: string | null;
  origem: string;
  created_at: string;
};

export const listarOptOuts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OptOutLinha[]> => {
    await exigirAdmin(context);
    const sb = await admin();
    const { data, error } = await sb
      .from("wa_opt_outs")
      .select("id, tipo, valor, motivo, origem, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw await erroGenerico("privacidade.listarOptOuts", error, "Não foi possível carregar a lista de descadastro.");
    return (data ?? []).map((r) => {
      const tipo = r.tipo as TipoOptOut;
      return {
        id: r.id,
        tipo,
        valorMascarado: mascarar(tipo, r.valor),
        motivo: r.motivo,
        origem: r.origem,
        created_at: r.created_at,
      };
    });
  });

const registrarOptOutSchema = z.object({
  tipo: z.enum(TIPOS_OPT_OUT, { errorMap: () => ({ message: "Escolha o tipo: CPF/CNPJ, e-mail ou telefone." }) }),
  valor: z.string({ required_error: "Informe o valor." }).trim().min(1, "Informe o valor.").max(254, "Valor muito longo."),
  motivo: z.string().trim().max(300, "O motivo deve ter no máximo 300 caracteres.").nullable().optional(),
});

export const registrarOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(registrarOptOutSchema))
  .handler(async ({ data, context }): Promise<{ criado: boolean }> => {
    await exigirAdmin(context);
    const valor = normalizarOptOut(data.tipo, data.valor);
    if (!valor) throw new Error("Valor inválido para o tipo escolhido.");
    const userId = (context as unknown as ContextoAutenticado).userId;
    const sb = await admin();

    // ON CONFLICT DO NOTHING: se já estava na lista, não devolve linha (e não é erro).
    const { data: inseridas, error } = await sb
      .from("wa_opt_outs")
      .upsert(
        { tipo: data.tipo, valor, motivo: data.motivo?.trim() || null, origem: "manual", criado_por: userId },
        { onConflict: "tipo,valor", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw await erroGenerico("privacidade.registrarOptOut", error, "Não foi possível registrar o descadastro.");

    const criado = (inseridas ?? []).length > 0;
    // Nunca o valor: só o tipo.
    await gravarAuditoria(context, "optout_registrado", "optout", inseridas?.[0]?.id ?? null, { tipo: data.tipo, ja_existia: !criado });
    return { criado };
  });

export const removerOptOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ id: z.string({ required_error: "Registro inválido." }).uuid("Registro inválido.") })))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await exigirAdmin(context);
    const sb = await admin();
    const { data: removidos, error } = await sb.from("wa_opt_outs").delete().eq("id", data.id).select("tipo");
    if (error) throw await erroGenerico("privacidade.removerOptOut", error, "Não foi possível remover o descadastro.");
    if (!removidos?.length) throw new Error("Registro de descadastro não encontrado.");
    await gravarAuditoria(context, "optout_removido", "optout", data.id, { tipo: removidos[0].tipo });
    return { ok: true };
  });

// ---------- Direitos do titular ----------

export type OcorrenciaTitular = {
  destinatario_id: string;
  campanha_id: string;
  campanha_nome: string;
  campanha_criada_em: string;
  status: string;
  empreendimento: string | null;
  enviado_em: string | null;
  /** "comprador" ou "conjuge". */
  papel: string;
};

export const consultarTitular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(titularSchema, "Dados do titular inválidos."))
  .handler(async ({ data, context }): Promise<{ ocorrencias: OcorrenciaTitular[]; emOptOut: boolean }> => {
    await exigirAdmin(context);
    const ids = normalizarIdentificadores(data);
    const sb = await admin();
    const tipos = tiposDe(ids);

    const [oc, ...optouts] = await Promise.all([
      sb.rpc("wa_titular_ocorrencias", paramsRpc(ids)),
      ...tipos.map((tipo) => sb.from("wa_opt_outs").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("valor", ids[tipo]!)),
    ]);
    if (oc.error) throw await erroGenerico("privacidade.consultarTitular", oc.error, "Não foi possível consultar o titular.");
    const erroOpt = optouts.find((r) => r.error)?.error;
    if (erroOpt) throw await erroGenerico("privacidade.consultarTitular.optout", erroOpt, "Não foi possível consultar o titular.");

    const ocorrencias: OcorrenciaTitular[] = (oc.data ?? []).map((o) => ({
      destinatario_id: o.destinatario_id,
      campanha_id: o.campanha_id,
      campanha_nome: o.campanha_nome,
      campanha_criada_em: o.campanha_criada_em,
      status: o.status,
      empreendimento: o.empreendimento,
      enviado_em: o.enviado_em,
      papel: o.papel,
    }));
    const emOptOut = optouts.some((r) => (r.count ?? 0) > 0);

    await gravarAuditoria(context, "titular_consultado", "titular", null, { identificadores: tipos, ocorrencias: ocorrencias.length });
    return { ocorrencias, emOptOut };
  });

export const anonimizarTitular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(titularSchema.extend({ registrarOptOut: z.boolean().optional() }), "Dados do titular inválidos."))
  .handler(async ({ data, context }): Promise<{ anonimizados: number; optoutFalhou: boolean }> => {
    await exigirSuperAdminComMfa(context);
    const ids = normalizarIdentificadores(data);
    const userId = (context as unknown as ContextoAutenticado).userId;
    const sb = await admin();

    const { data: n, error } = await sb.rpc("wa_anonimizar_titular", paramsRpc(ids));
    if (error) throw await erroGenerico("privacidade.anonimizarTitular", error, "Não foi possível anonimizar o titular.");

    // O pedido de eliminação já foi atendido; se o descadastro falhar, avisa sem desfazer nada.
    let optout = false;
    let optoutFalhou = false;
    if (data.registrarOptOut === true) {
      const r = await gravarOptOuts(sb, ids, "titular", "Pedido de eliminação de dados do titular", userId);
      if (r.error) {
        optoutFalhou = true;
        (await import("@/lib/erros.server")).logErro("privacidade.anonimizarTitular.optout", r.error);
      } else {
        optout = true;
      }
    }

    const anonimizados = typeof n === "number" ? n : 0;
    await gravarAuditoria(context, "titular_anonimizado", "titular", null, {
      linhas: anonimizados,
      identificadores: tiposDe(ids),
      optout,
    });
    return { anonimizados, optoutFalhou };
  });

// ---------- Anonimização de campanha ----------

export type CampanhaParaAnonimizar = {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  criado_por_nome: string | null;
  destinatarios_total: number;
  destinatarios_pendentes_anonimizacao: number;
};

const PAGINA = 1000;
const MAX_PAGINAS = 100;

export const listarCampanhasParaAnonimizar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CampanhaParaAnonimizar[]> => {
    await exigirSuperAdmin(context);
    const sb = await admin();

    // 1) Campanhas + total de destinatários de cada uma (contagem embutida, sem N+1).
    const { data: campanhas, error } = await sb
      .from("wa_campanhas")
      .select("id, nome, status, created_at, criado_por, destinatarios:wa_campanha_destinatarios(count)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw await erroGenerico("privacidade.listarCampanhas", error, "Não foi possível carregar as campanhas.");
    const lista = campanhas ?? [];
    if (!lista.length) return [];
    const ids = lista.map((c) => c.id);

    // 2) Destinatários ainda não anonimizados dessas campanhas (paginado: a Data API limita as linhas).
    const pendentes = new Map<string, number>();
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const { data: linhas, error: e2 } = await sb
        .from("wa_campanha_destinatarios")
        .select("id, campanha_id")
        .in("campanha_id", ids)
        .is("anonimizado_em", null)
        .order("id")
        .range(pagina * PAGINA, (pagina + 1) * PAGINA - 1);
      if (e2) throw await erroGenerico("privacidade.listarCampanhas.pendentes", e2, "Não foi possível carregar as campanhas.");
      for (const l of linhas ?? []) pendentes.set(l.campanha_id, (pendentes.get(l.campanha_id) ?? 0) + 1);
      if ((linhas ?? []).length < PAGINA) break;
    }

    // Nome de quem criou (uma consulta só, nunca por campanha).
    const criadores = [...new Set(lista.map((c) => c.criado_por).filter((v): v is string => !!v))];
    const nomes = new Map<string, string>();
    if (criadores.length) {
      const { data: perfis } = await sb.from("profiles").select("id, full_name, email").in("id", criadores);
      for (const p of perfis ?? []) nomes.set(p.id, p.full_name || p.email || "");
    }

    return lista.map((c) => {
      const contagem = c.destinatarios as unknown as { count: number }[] | null;
      return {
        id: c.id,
        nome: c.nome,
        status: c.status,
        created_at: c.created_at,
        criado_por_nome: (c.criado_por && nomes.get(c.criado_por)) || null,
        destinatarios_total: contagem?.[0]?.count ?? 0,
        destinatarios_pendentes_anonimizacao: pendentes.get(c.id) ?? 0,
      };
    });
  });

export const anonimizarCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(z.object({ campanhaId: z.string({ required_error: "Campanha inválida." }).uuid("Campanha inválida.") })))
  .handler(async ({ data, context }): Promise<{ anonimizados: number }> => {
    await exigirSuperAdminComMfa(context);
    const sb = await admin();

    const { data: camp, error: e1 } = await sb.from("wa_campanhas").select("id").eq("id", data.campanhaId).maybeSingle();
    if (e1) throw await erroGenerico("privacidade.anonimizarCampanha.busca", e1, "Não foi possível anonimizar a campanha.");
    if (!camp) throw new Error("Campanha não encontrada.");

    const { data: n, error } = await sb.rpc("wa_anonimizar_campanha", { p_campanha_id: data.campanhaId });
    if (error) throw await erroGenerico("privacidade.anonimizarCampanha", error, "Não foi possível anonimizar a campanha.");

    const anonimizados = typeof n === "number" ? n : 0;
    await gravarAuditoria(context, "campanha_anonimizada", "campanha", data.campanhaId, { linhas: anonimizados });
    return { anonimizados };
  });

// ---------- Retenção ----------

export type RetencaoConfig = { destinatarios_meses: number; campanhas_abertas_meses: number };

const PADRAO_RETENCAO: RetencaoConfig = { destinatarios_meses: 12, campanhas_abertas_meses: 18 };

async function lerRetencao(sb: SupabaseAdmin): Promise<RetencaoConfig> {
  const { data, error } = await sb
    .from("wa_retencao_config")
    .select("destinatarios_meses, campanhas_abertas_meses")
    .eq("id", true)
    .maybeSingle();
  if (error) throw await erroGenerico("privacidade.lerRetencao", error, "Não foi possível carregar a retenção.");
  return data ?? PADRAO_RETENCAO;
}

export const obterRetencao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetencaoConfig> => {
    await exigirAdmin(context);
    return lerRetencao(await admin());
  });

const meses = (rotulo: string) =>
  z
    .number({ required_error: `${rotulo}: informe os meses.`, invalid_type_error: `${rotulo}: informe um número.` })
    .int(`${rotulo}: use um número inteiro de meses.`)
    .min(1, `${rotulo}: no mínimo 1 mês.`)
    .max(120, `${rotulo}: no máximo 120 meses.`);

export const salvarRetencao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validar(z.object({ destinatarios_meses: meses("Destinatários"), campanhas_abertas_meses: meses("Campanhas abertas") })),
  )
  .handler(async ({ data, context }): Promise<RetencaoConfig> => {
    await exigirSuperAdminComMfa(context);
    const sb = await admin();
    const anterior = await lerRetencao(sb);

    // Linha única (id = true); upsert cobre o caso de a linha inicial ter sido apagada.
    const { error } = await sb
      .from("wa_retencao_config")
      .upsert(
        { id: true, destinatarios_meses: data.destinatarios_meses, campanhas_abertas_meses: data.campanhas_abertas_meses },
        { onConflict: "id" },
      );
    if (error) throw await erroGenerico("privacidade.salvarRetencao", error, "Não foi possível salvar a retenção.");

    await gravarAuditoria(context, "retencao_alterada", "retencao", null, {
      destinatarios_meses: data.destinatarios_meses,
      campanhas_abertas_meses: data.campanhas_abertas_meses,
      anterior_destinatarios_meses: anterior.destinatarios_meses,
      anterior_campanhas_abertas_meses: anterior.campanhas_abertas_meses,
    });
    return { destinatarios_meses: data.destinatarios_meses, campanhas_abertas_meses: data.campanhas_abertas_meses };
  });
