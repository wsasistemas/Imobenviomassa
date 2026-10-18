import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPapel, type ContextoAutenticado } from "@/lib/authz";
import { formatarDocumento, mascararDocumento, objetosParaCsv } from "@/lib/csv";
import { mascararEmail, mascararTelefone } from "@/lib/mascaras";
import {
  DEST_STATUS_LABEL,
  getStatusAssinatura,
  getStatusAssinaturaSimples,
  STATUS_SIMPLES_LABEL,
  type StatusAssinaturaSimples,
} from "@/lib/relatorios/status";

// Relatório de campanha — LGPD (auditoria de segurança 2026-10-01, Fase 4, itens L1 e L11).
//
// Antes o CSV era montado no navegador (telefone e e-mail completos, sem rastro). Agora:
//   · exportarRelatorioCsv   gera o CSV NO SERVIDOR: mascarado por padrão (CPF, telefone e e-mail);
//                            o CSV completo é só de Admin/Super Admin; toda exportação é auditada
//                            (quem, qual campanha, quantas linhas, se completo — nunca os valores);
//   · contatosDaCampanha     telefone e e-mail dos destinatários para a TELA: o navegador não lê
//                            mais essas colunas (migração 20261001190000 restringe o SELECT por
//                            coluna). Devolve mascarados; com `revelar` devolve completos e audita
//                            `contatos_revelados`. CPF e dados do cônjuge nunca vão para a tela.

const PAPEIS_OPERACAO = ["operadora", "admin", "super_admin"] as const;
const LIMITE_LINHAS_EXPORT = 5000;

const exportarSchema = z.object({
  campanhaId: z.string().uuid("Campanha inválida."),
  completo: z.boolean().optional(),
  statusFiltro: z.string().trim().max(30).optional(),
  busca: z.string().trim().max(100).optional(),
  // Filtros de bloco/unidade da tela de relatório: o CSV continua refletindo o que o usuário filtrou.
  blocoFiltro: z.string().trim().max(50).optional(),
  unidadeFiltro: z.string().trim().max(50).optional(),
});

export type ExportarRelatorioInput = z.input<typeof exportarSchema>;

const contatosSchema = z.object({
  campanhaId: z.string().uuid("Campanha inválida."),
  revelar: z.boolean().optional(),
});

function validar<T extends z.ZodTypeAny>(schema: T) {
  return (input: unknown): z.infer<T> => {
    const r = schema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
    return r.data;
  };
}

/** Mesmo formato de data da tela (pt-BR), no fuso de Brasília — o servidor roda em UTC. */
function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

async function exigirAcessoCampanha(context: unknown, campanhaId: string): Promise<ContextoAutenticado> {
  const ctx = context as ContextoAutenticado;
  await exigirPapel(
    ctx,
    [...PAPEIS_OPERACAO],
    "Seu perfil não tem acesso aos relatórios. Solicite o papel de operadora a um administrador.",
  );
  // Dono da campanha ou Admin/Super Admin (mesma regra do envio e do reenvio).
  const { assertCampanhaDoUsuario } = await import("@/lib/integracoes/docusign.functions");
  await assertCampanhaDoUsuario(ctx, campanhaId);
  return ctx;
}

export const exportarRelatorioCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(exportarSchema))
  .handler(async ({ data, context }): Promise<{ nome: string; csv: string; linhas: number }> => {
    const completo = data.completo === true;
    const ctx = await exigirAcessoCampanha(context, data.campanhaId);
    // CSV completo (CPF, telefone e e-mail inteiros): só Admin e Super Admin.
    if (completo) await exigirPapel(ctx, ["admin", "super_admin"], "Só Admin e Super Admin exportam o CSV completo.");

    const statusFiltro = data.statusFiltro && data.statusFiltro !== "todos" ? data.statusFiltro : null;
    if (statusFiltro && !Object.keys(STATUS_SIMPLES_LABEL).includes(statusFiltro)) throw new Error("Filtro de status inválido.");

    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { erroGenerico } = await import("@/lib/erros.server");
    const { auditar } = await import("@/lib/auditoria.server");

    const [campRes, destRes, envRes] = await Promise.all([
      sb.from("wa_campanhas").select("id, nome").eq("id", data.campanhaId).maybeSingle(),
      sb
        .from("wa_campanha_destinatarios")
        .select(
          "id, nome, cpf, telefone, email, empreendimento, bloco, unidade, status, envelope_docusign_id, enviado_em, assinado_em, erro_msg, updated_at",
        )
        .eq("campanha_id", data.campanhaId)
        .order("created_at", { ascending: true })
        .limit(LIMITE_LINHAS_EXPORT),
      sb
        .from("docusign_envelopes")
        .select("envelope_id, status, sent_at, completed_at, declined_at, voided_at, last_event_at")
        .eq("campanha_id", data.campanhaId)
        .limit(LIMITE_LINHAS_EXPORT),
    ]);
    if (campRes.error || destRes.error || envRes.error) {
      throw erroGenerico("relatorios.exportar", campRes.error ?? destRes.error ?? envRes.error, "Não foi possível gerar o relatório.");
    }
    const camp = campRes.data;
    if (!camp) throw new Error("Campanha não encontrada.");

    const envelopePorId = new Map((envRes.data ?? []).map((e) => [e.envelope_id, e]));

    const busca = (data.busca ?? "").toLowerCase();
    const bloco = (data.blocoFiltro ?? "").toLowerCase();
    const unidade = (data.unidadeFiltro ?? "").toLowerCase();

    const selecionados = (destRes.data ?? []).flatMap((d) => {
      const env = d.envelope_docusign_id ? envelopePorId.get(d.envelope_docusign_id) : undefined;
      const statusAssinatura = getStatusAssinatura(d, env);
      const statusSimples: StatusAssinaturaSimples = getStatusAssinaturaSimples(d, env);
      // Mesmos filtros da tela (RelatorioDetalheView): status, bloco, unidade e busca por texto.
      if (statusFiltro && statusSimples !== statusFiltro) return [];
      if (bloco && !(d.bloco ?? "").toLowerCase().includes(bloco)) return [];
      if (unidade && !(d.unidade ?? "").toLowerCase().includes(unidade)) return [];
      // A busca cobre nome, empreendimento, bloco, unidade e os contatos COMO A TELA OS MOSTRA
      // (mascarados; reais só no CSV completo, que é de admin e auditado). CPF não entra na busca:
      // senão o CSV serviria para confirmar se um CPF/telefone/e-mail consta na campanha.
      if (busca) {
        const campos = [
          d.nome,
          d.empreendimento,
          d.bloco,
          d.unidade,
          completo ? d.telefone : mascararTelefone(d.telefone),
          completo ? d.email : mascararEmail(d.email),
        ];
        if (!campos.some((c) => (c ?? "").toLowerCase().includes(busca))) return [];
      }
      return [{ d, statusAssinatura, statusSimples }];
    });

    if (selecionados.length === 0) throw new Error("Nada para exportar.");

    const colCpf = completo ? "CPF" : "CPF (mascarado)";
    const colTelefone = completo ? "telefone" : "telefone (mascarado)";
    const colEmail = completo ? "email" : "email (mascarado)";
    const cabecalho = [
      "nome",
      colCpf,
      colTelefone,
      colEmail,
      "empreendimento",
      "bloco",
      "unidade",
      "status",
      "docusign_status",
      "envelope_id",
      "enviado_em",
      "entregue_em",
      "assinado_em",
      "cancelado_em",
      "ultima_atualizacao",
      "erro",
    ];
    const linhas = selecionados.map(({ d, statusAssinatura: s, statusSimples }) => ({
      nome: d.nome,
      [colCpf]: completo ? formatarDocumento(d.cpf) : mascararDocumento(d.cpf),
      [colTelefone]: completo ? (d.telefone ?? "") : d.telefone ? mascararTelefone(d.telefone) : "",
      [colEmail]: completo ? (d.email ?? "") : d.email ? mascararEmail(d.email) : "",
      empreendimento: d.empreendimento ?? "",
      bloco: d.bloco ?? "",
      unidade: d.unidade ?? "",
      status: s.status === "opt_out" ? DEST_STATUS_LABEL.opt_out : STATUS_SIMPLES_LABEL[statusSimples],
      docusign_status: s.docusign_status ?? "",
      envelope_id: d.envelope_docusign_id ?? "",
      enviado_em: formatarData(d.enviado_em),
      entregue_em: formatarData(s.entregue_em),
      assinado_em: formatarData(s.assinado_em),
      cancelado_em: formatarData(s.cancelado_em),
      ultima_atualizacao: formatarData(s.last_event_at),
      erro: d.erro_msg ?? "",
    }));

    const csv = objetosParaCsv(linhas, cabecalho);
    const nomeBase = `relatorio_${completo ? "completo_" : ""}${camp.nome}`.slice(0, 80);
    const nome = `${nomeBase}_${new Date().toISOString().slice(0, 10)}.csv`.replace(/[^\w\-.]+/g, "_");

    // Trilha: quem exportou, de qual campanha, quantas linhas e se foi completo. Nunca os valores.
    await auditar({
      userId: ctx.userId,
      acao: "relatorio_exportado",
      entidade: "campanha",
      entidadeId: camp.id,
      detalhes: {
        linhas: linhas.length,
        completo,
        filtrado: Boolean(statusFiltro || busca || bloco || unidade),
      },
    });

    return { nome, csv, linhas: linhas.length };
  });

export type ContatosCampanha = {
  /** Por id do destinatário. null quando a pessoa não tem o contato (ou foi anonimizada). */
  contatos: Record<string, { telefone: string | null; email: string | null }>;
  revelado: boolean;
};

/**
 * Telefone e e-mail dos destinatários da campanha para a tela de relatório. O navegador não lê essas
 * colunas (GRANT por coluna, migração 20261001190000); só o servidor. Mascarados por padrão; com
 * `revelar: true` vão completos e a revelação é auditada (`contatos_revelados`, sem os valores).
 */
export const contatosDaCampanha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar(contatosSchema))
  .handler(async ({ data, context }): Promise<ContatosCampanha> => {
    const revelar = data.revelar === true;
    const ctx = await exigirAcessoCampanha(context, data.campanhaId);

    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: linhas, error } = await sb
      .from("wa_campanha_destinatarios")
      .select("id, telefone, email")
      .eq("campanha_id", data.campanhaId)
      .limit(LIMITE_LINHAS_EXPORT);
    if (error) {
      const { erroGenerico } = await import("@/lib/erros.server");
      throw erroGenerico("relatorios.contatos", error, "Não foi possível carregar os contatos.");
    }

    const contatos: ContatosCampanha["contatos"] = {};
    for (const l of linhas ?? []) {
      contatos[l.id] = revelar
        ? { telefone: l.telefone, email: l.email }
        : {
            telefone: l.telefone ? mascararTelefone(l.telefone) : null,
            email: l.email ? mascararEmail(l.email) : null,
          };
    }

    if (revelar) {
      const { auditar } = await import("@/lib/auditoria.server");
      await auditar({
        userId: ctx.userId,
        acao: "contatos_revelados",
        entidade: "campanha",
        entidadeId: data.campanhaId,
        detalhes: { linhas: (linhas ?? []).length },
      });
    }

    return { contatos, revelado: revelar };
  });
