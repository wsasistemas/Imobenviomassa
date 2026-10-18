import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPoliticaSenha } from "@/lib/senha";

// Troca da própria senha (primeiro acesso / troca exigida pelo Super Admin).
//
// A flag wa_project_users.trocar_senha só é desligada aqui, pelo servidor, depois de a senha atual
// ser conferida e a nova ser gravada — nenhuma chamada do navegador desliga a flag sozinha.
//
// A conferência da senha atual conta como tentativa de login (auth_pre_login / auth_registrar_
// resultado, origem 'troca_senha'): um token roubado não serve de oráculo para adivinhar a senha.
// Depois da troca, as outras sessões da pessoa são revogadas (auth_revogar_sessoes, migração
// 20261001150000); a sessão atual continua.
//
// Fase 4 / N21: (1) só quem tem conta ATIVA no portal (linha em wa_project_users, ativo !== false) chega
// a testar a senha — NÃO exige trocar_senha === false, pois esta função é justamente a que libera a
// troca pendente; (2) a sessão criada pelo login de verificação é encerrada na hora (signOut local),
// para não acumular sessões órfãs em auth.sessions a cada troca.

type Contexto = { userId: string; claims?: { email?: string; session_id?: string } };

export const trocarMinhaSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { senhaAtual: string; novaSenha: string }) => {
    const senhaAtual = typeof input.senhaAtual === "string" ? input.senhaAtual.slice(0, 128) : "";
    const novaSenha = typeof input.novaSenha === "string" ? input.novaSenha.slice(0, 128) : "";
    if (!senhaAtual) throw new Error("Informe a senha atual.");
    exigirPoliticaSenha(novaSenha);
    if (novaSenha === senhaAtual) throw new Error("A nova senha precisa ser diferente da atual.");
    return { senhaAtual, novaSenha };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const ctx = context as unknown as Contexto;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");
    const { auditar, ipDaRequisicao, userAgentDaRequisicao } = await import("@/lib/auditoria.server");

    let email = ctx.claims?.email;
    if (!email) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
      email = u.user?.email ?? undefined;
    }
    if (!email) throw new Error("Não foi possível identificar a sua conta.");
    email = email.toLowerCase();

    // Cadastro no app ativo? (sem linha ou desativado não testa senha nem conta como tentativa).
    const { data: membro, error: membroErr } = await supabaseAdmin
      .from("usuarios")
      .select("ativo")
      .eq("id", ctx.userId)
      .maybeSingle();
    if (membroErr) {
      const { erroGenerico } = await import("@/lib/erros.server");
      throw erroGenerico("conta.trocarMinhaSenha", membroErr, "Não foi possível validar o acesso. Tente novamente.");
    }
    if (!membro || membro.ativo === false) throw new Error("Sua conta não tem acesso a este portal.");

    const ip = ipDaRequisicao();
    const ua = userAgentDaRequisicao();

    // Bloqueio por conta/IP vale aqui também.
    const pre = await supabaseAdmin.rpc("auth_pre_login", { p_email: email, p_ip: ip });
    if ((pre.data as { permitido?: boolean } | null)?.permitido === false) {
      throw new Error("Muitas tentativas. Tente novamente em alguns minutos.");
    }

    // Confere a senha atual com um login de verificação (sessão encerrada logo em seguida).
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configuração do Supabase indisponível no servidor.");
    const verificador = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: login, error: loginErr } = await verificador.auth.signInWithPassword({
      email,
      password: data.senhaAtual,
    });
    // A sessão do login de verificação não serve a ninguém: encerra já (sucesso ou não), para não
    // deixar linha órfã em auth.sessions.
    try {
      await verificador.auth.signOut({ scope: "local" });
    } catch (e) {
      console.error("[conta] signOut da sessão de verificação:", e instanceof Error ? e.message : String(e));
    }
    if (loginErr || login.user?.id !== ctx.userId) {
      const r = await supabaseAdmin.rpc("auth_registrar_resultado", {
        p_email: email,
        p_ip: ip,
        p_ok: false,
        p_user_id: ctx.userId,
        p_ua: ua,
        p_origem: "troca_senha",
      });
      const bloqueado = (r.data as { bloqueado?: boolean } | null)?.bloqueado === true;
      throw new Error(bloqueado ? "Muitas tentativas. Tente novamente em alguns minutos." : "A senha atual não confere.");
    }
    await supabaseAdmin.rpc("auth_registrar_resultado", {
      p_email: email,
      p_ip: ip,
      p_ok: true,
      p_user_id: ctx.userId,
      p_ua: ua,
      p_origem: "troca_senha",
    });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(ctx.userId, { password: data.novaSenha });
    if (error) {
      console.error("[conta] updateUserById:", error.message);
      throw new Error("Não foi possível trocar a senha. Tente novamente.");
    }

    // Libera o acesso.
    const { error: flagErr } = await supabaseAdmin
      .from("usuarios")
      .update({ trocar_senha: false })
      .eq("id", ctx.userId);
    if (flagErr) {
      console.error("[conta] liberar acesso:", flagErr.message);
      throw new Error("A senha foi trocada, mas não foi possível liberar o acesso. Fale com o administrador.");
    }

    // Derruba as outras sessões (a atual, identificada pelo session_id do JWT, continua).
    const sessaoAtual = typeof ctx.claims?.session_id === "string" ? ctx.claims.session_id : null;
    const revog = await supabaseAdmin.rpc("auth_revogar_sessoes", { p_user_id: ctx.userId, p_manter_sessao: sessaoAtual });
    if (revog.error) console.error("[conta] auth_revogar_sessoes:", revog.error.message);

    await auditar({
      userId: ctx.userId,
      acao: "senha_alterada",
      entidade: "usuario",
      entidadeId: ctx.userId,
      detalhes: { outras_sessoes_revogadas: revog.error ? null : revog.data },
    });
    return { ok: true };
  });
