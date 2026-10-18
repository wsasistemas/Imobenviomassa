import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContextoAutenticado } from "@/lib/authz";
import { exigirAdminEVerSePrivilegiado, mascararEmailLog, mascararIp } from "@/lib/logs.functions";

// Login pelo servidor (auditoria de segurança 2026-10-01, item C4).
//
// O navegador não chama mais signInWithPassword direto no Supabase: passa por aqui, onde contamos as
// tentativas por IP e por conta (RPCs auth_pre_login / auth_registrar_resultado, migrações
// 20261001120000 e 20261001140000), bloqueamos com backoff e registramos quem entrou, de onde e o
// resultado (auth_login_log). A tentativa é CONTADA em auth_pre_login, antes de a senha chegar ao
// GoTrue (atômico: uma rajada paralela não testa mais de 5 senhas); o sucesso zera os contadores.
// Limites (auth_bloqueio_config): 5 falhas / 15 min por conta com backoff 15 min × 2ⁿ (até 24 h);
// 20 falhas / 15 min por IP com bloqueio fixo de 15 min (atrás de NAT corporativo o IP é de todos).
// Sem IP confiável (fora da Vercel) só vale o limite por conta. O bloqueio POR CONTA também vale dentro do próprio Supabase Auth pelo hook
// "Password Verification Attempt" (hook_verificacao_senha) — ninguém o contorna chamando o GoTrue
// direto com a chave pública.
//
// Mensagens: uma só para credencial inválida (não revela se o e-mail existe) e uma só para bloqueio
// (igual para IP e conta).

export const MSG_CREDENCIAL_INVALIDA = "E-mail ou senha incorretos.";
export const MSG_BLOQUEADO = "Muitas tentativas. Tente novamente em alguns minutos.";
export const MSG_CONTA_INATIVA = "Sua conta não tem acesso a este portal. Fale com o administrador do sistema.";

export type LoginResultado = {
  access_token: string;
  refresh_token: string;
  trocar_senha: boolean;
};

/** Atraso aleatório para a resposta não denunciar, pelo tempo, qual verificação falhou. */
async function jitter(minMs: number, maxMs: number) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, ms));
}

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase().slice(0, 254);
    const password = String(input?.password ?? "").slice(0, 128);
    if (!email || !password) throw new Error("Informe e-mail e senha.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(MSG_CREDENCIAL_INVALIDA);
    return { email, password };
  })
  .handler(async ({ data }): Promise<LoginResultado> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");
    const { ipDaRequisicao, userAgentDaRequisicao, auditar } = await import("@/lib/auditoria.server");

    const ip = ipDaRequisicao();
    const ua = userAgentDaRequisicao();

    // 1) IP ou conta bloqueados? (também conta/reserva esta tentativa)
    const pre = await supabaseAdmin.rpc("auth_pre_login", { p_email: data.email, p_ip: ip });
    if (pre.error) {
      console.error("[login] auth_pre_login:", pre.error.message);
      throw new Error("Não foi possível validar o acesso. Tente novamente.");
    }
    const preData = pre.data as { permitido?: boolean } | null;
    if (!preData?.permitido) {
      await supabaseAdmin.rpc("auth_registrar_resultado", {
        p_email: data.email,
        p_ip: ip,
        p_ok: false,
        p_ua: ua,
        p_resultado: "bloqueado",
      });
      await jitter(300, 700);
      throw new Error(MSG_BLOQUEADO);
    }

    // 2) Autentica no Supabase Auth com a chave pública (sessão não persiste no servidor)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configuração do Supabase indisponível no servidor.");
    const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: sessao, error } = await anon.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !sessao.session || !sessao.user) {
      const bloqueadoPeloHook = error?.status === 429 || /muitas tentativas|too many|rate limit/i.test(error?.message ?? "");
      const r = await supabaseAdmin.rpc("auth_registrar_resultado", {
        p_email: data.email,
        p_ip: ip,
        p_ok: false,
        p_ua: ua,
        p_resultado: bloqueadoPeloHook ? "bloqueado" : "credencial_invalida",
      });
      const bloqueado = bloqueadoPeloHook || (r.data as { bloqueado?: boolean } | null)?.bloqueado === true;
      await jitter(300, 700);
      throw new Error(bloqueado ? MSG_BLOQUEADO : MSG_CREDENCIAL_INVALIDA);
    }

    const userId = sessao.user.id;

    // 3) Conta do portal: sem linha de membro ou desativada não recebe sessão (a conta de login é
    //    compartilhada com outros sistemas Calper; aqui só entra quem foi cadastrado em Usuários).
    const { data: membro } = await supabaseAdmin
      .from("wa_project_users")
      .select("ativo, trocar_senha")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membro || membro.ativo === false) {
      await supabaseAdmin.rpc("auth_registrar_resultado", {
        p_email: data.email,
        p_ip: ip,
        p_ok: true,
        p_user_id: userId,
        p_ua: ua,
        p_resultado: "conta_inativa",
      });
      throw new Error(MSG_CONTA_INATIVA);
    }

    // 4) Sucesso: zera contadores, registra e audita
    await supabaseAdmin.rpc("auth_registrar_resultado", {
      p_email: data.email,
      p_ip: ip,
      p_ok: true,
      p_user_id: userId,
      p_ua: ua,
    });
    await auditar({ userId, acao: "login", entidade: "usuario", entidadeId: userId, detalhes: { email: data.email } });

    return {
      access_token: sessao.session.access_token,
      refresh_token: sessao.session.refresh_token,
      trocar_senha: membro.trocar_senha === true,
    };
  });

export type TentativaLogin = {
  id: number;
  created_at: string;
  email_norm: string | null;
  ip: string | null;
  origem: string;
  resultado: string;
};

export type TentativasLoginResultado = {
  linhas: TentativaLogin[];
  /** true quando IP e e-mail foram mascarados (chamador não é Super Admin). */
  mascarado: boolean;
};

/**
 * Últimas tentativas de login (Administração → Logs). Admin e Super Admin; só o Super Admin vê IP e
 * e-mail completos (Fase 4 / N16, LGPD) — para o Admin vão mascarados (`203.0.***.***`, `j***@dominio.com`).
 */
export const listarTentativasLogin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TentativasLoginResultado> => {
    const verTudo = await exigirAdminEVerSePrivilegiado(context as ContextoAutenticado);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("auth_login_log")
      .select("id, created_at, email_norm, ip, origem, resultado")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      console.error("[login] listar tentativas:", error.message);
      throw new Error("Não foi possível carregar as tentativas de login.");
    }
    const linhas = (data ?? []) as TentativaLogin[];
    if (verTudo) return { linhas, mascarado: false };
    return {
      linhas: linhas.map((l) => ({ ...l, email_norm: mascararEmailLog(l.email_norm), ip: mascararIp(l.ip) })),
      mascarado: true,
    };
  });
