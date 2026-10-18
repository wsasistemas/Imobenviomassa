import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { exigirPapel, imobiliariaDoContexto, temPapel, type ContextoAutenticado } from "@/lib/authz";

// Administração → Logs, lido pelo SERVIDOR (auditoria de segurança 2026-10-01, item N16 / Fase 4 LGPD).
//
// O navegador não lê mais wa_auditoria pela Data API (SELECT revogado de `authenticated` na migração
// 20261001180000): a leitura passa por aqui, com service_role, depois de conferido o papel.
// Super Admin vê IP e e-mail completos; Admin comum vê com máscara (IP `203.0.***.***`, e-mail
// `j***@dominio.com`), pois IP e e-mail de quem acessa são dados pessoais (LGPD).

export const LIMITE_AUDITORIA = 3000;

export type LinhaAuditoria = {
  id: string;
  created_at: string;
  usuario_nome: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Json | null;
  ip: string | null;
};

export type AuditoriaResultado = {
  linhas: LinhaAuditoria[];
  /** true quando IP e e-mail foram mascarados (chamador não é Super Admin). */
  mascarado: boolean;
};

// ---------------------------------------------------------------------
// Máscaras (puras; também usadas por listarTentativasLogin em auth.functions.ts)
// ---------------------------------------------------------------------

/**
 * IPv4: `203.0.113.7` → `203.0.***.***`. IPv6: mantém os 2 primeiros grupos e mascara o resto
 * (`2001:db8:***:***`). IPv4 mapeado em IPv6 (`::ffff:203.0.113.7`) mascara a parte IPv4.
 * Valores que não são IP (ex.: "desconhecido") passam como estão.
 */
export function mascararIp(ip: string | null | undefined): string | null {
  if (ip == null) return null;
  const v = String(ip).trim();
  if (!v) return v;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(v);
  if (v4) return `${v4[1]}.${v4[2]}.***.***`;
  const mapeado = /^(.*:)(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(v);
  if (mapeado) return `${mapeado[1]}${mapeado[2]}.***.***`;
  if (v.includes(":") && /^[0-9a-f:%.\w-]+$/i.test(v)) {
    const sem = v.split("%")[0];
    if (sem.startsWith("::")) return "::***";
    const grupos = sem.split(":");
    const ini = grupos.slice(0, 2).filter(Boolean);
    return ini.length === 2 ? `${ini[0]}:${ini[1]}:***:***` : `${ini[0] ?? ""}:***`;
  }
  return v;
}

/** `joao@dominio.com` → `j***@dominio.com`. Texto sem "@" passa como está. */
export function mascararEmailLog(email: string | null | undefined): string | null {
  if (email == null) return null;
  const v = String(email).trim();
  const arroba = v.lastIndexOf("@");
  if (arroba < 0) return v;
  const local = v.slice(0, arroba);
  const dominio = v.slice(arroba + 1);
  return `${local ? local[0] : ""}***@${dominio}`;
}

const REGEX_EMAIL_EM_TEXTO = /[^\s@"'<>(),;:]+@[^\s@"'<>(),;]+\.[A-Za-z]{2,}/g;

/** Mascara e-mails escondidos em textos (usuario_nome, valores dentro de `detalhes`). */
function mascararEmailsNoTexto(texto: string): string {
  return texto.replace(REGEX_EMAIL_EM_TEXTO, (m) => mascararEmailLog(m) ?? m);
}

function mascararEmailsEmValor(v: unknown, profundidade = 0): unknown {
  if (typeof v === "string") return mascararEmailsNoTexto(v);
  if (profundidade >= 6) return v;
  if (Array.isArray(v)) return v.map((x) => mascararEmailsEmValor(x, profundidade + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = mascararEmailsEmValor(x, profundidade + 1);
    return out;
  }
  return v;
}

/**
 * Exige Admin ou Super Admin e diz se o chamador é Super Admin (vê tudo sem máscara).
 * Equivale a exigirPapel(["admin","super_admin"]) + temPapel(["super_admin"]), com uma ida a menos ao banco.
 */
export async function exigirAdminEVerSePrivilegiado(
  context: ContextoAutenticado,
  mensagem = "Seu perfil não tem acesso aos logs.",
): Promise<boolean> {
  if (await temPapel(context, ["super_admin"])) return true;
  await exigirPapel(context, ["admin"], mensagem);
  return false;
}

// ---------------------------------------------------------------------
// Histórico de ações (wa_auditoria)
// ---------------------------------------------------------------------

/** Histórico de ações do portal (Administração → Logs). Admin (com máscara) e Super Admin. */
export const listarAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditoriaResultado> => {
    const ctx = context as ContextoAutenticado;
    const verTudo = await exigirAdminEVerSePrivilegiado(ctx, "Seu perfil não tem acesso ao histórico de ações.");

    const imob = await imobiliariaDoContexto(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wa_auditoria")
      .select("id, created_at, usuario_nome, acao, entidade, entidade_id, detalhes, ip")
      .eq("imobiliaria_id", imob)
      .order("created_at", { ascending: false })
      .limit(LIMITE_AUDITORIA);
    if (error) {
      const { erroGenerico } = await import("@/lib/erros.server");
      throw erroGenerico("logs.listarAuditoria", error, "Não foi possível carregar o histórico.");
    }

    const linhas = (data ?? []) as LinhaAuditoria[];
    if (verTudo) return { linhas, mascarado: false };
    return {
      linhas: linhas.map((l) => ({
        ...l,
        ip: mascararIp(l.ip),
        usuario_nome: l.usuario_nome == null ? null : mascararEmailsNoTexto(l.usuario_nome),
        detalhes: mascararEmailsEmValor(l.detalhes) as Json | null,
      })),
      mascarado: true,
    };
  });
