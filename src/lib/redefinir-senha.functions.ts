import { createServerFn } from "@tanstack/react-start";
import { exigirPoliticaSenha } from "@/lib/senha";

// "Esqueceu a senha?" (tela de login) — migração 20261019140000_imobenviomassa_05_redefinir_senha.
//
// O link é gerado e enviado pelo próprio app, pelo provedor de e-mail da imobiliária da pessoa (Integrações ›
// E-mail), e não pelo e-mail de recuperação do Supabase: no projeto compartilhado o link padrão cai no Site URL
// de outro sistema quando o endereço não está na allowlist, e o SMTP padrão tem limite baixo.
//
// Regras:
// - resposta SEMPRE igual, exista ou não a conta (não revela quem tem cadastro);
// - token aleatório de 32 bytes, de uso único, vale 30 min; no banco fica só o sha-256;
// - limite: 3 pedidos por e-mail e 10 por IP a cada hora (contados em senha_redefinicao);
// - o link usa a origem da requisição só se ela estiver na lista de origens do portal (evita host injection);
// - ao redefinir: grava a senha, invalida os outros links, derruba todas as sessões, desbloqueia a conta e
//   libera a troca obrigatória. A conta de login é compartilhada com ImobSystem, Imobsuprimentos e ImobDoces.

export const MSG_PEDIDO_RECEBIDO =
  "Se o e-mail tiver cadastro ativo, enviamos um link para redefinir a senha. Ele vale por 30 minutos.";
const MSG_LINK_INVALIDO = 'Este link é inválido ou expirou. Peça um novo em "Esqueceu a senha?".';

const VALIDADE_MIN = 30;
const LIMITE_EMAIL_HORA = 3;
const LIMITE_IP_HORA = 10;

async function sha256(texto: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(texto).digest("hex");
}

function origemValida(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Origem do link: a da requisição se for uma das origens do portal; senão APP_URL / domínio de produção. */
async function origemDoPortal(): Promise<string | null> {
  const permitidas = [
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .map(origemValida)
    .filter((o): o is string => !!o);
  let pedida: string | null = null;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    pedida =
      origemValida(req?.headers.get("origin")) ??
      origemValida(req?.url ? new URL(req.url).origin : null);
  } catch {
    /* fora de requisição */
  }
  if (pedida) {
    const host = new URL(pedida).hostname;
    if (permitidas.includes(pedida) || host === "localhost" || host === "127.0.0.1") return pedida;
  }
  return permitidas[0] ?? null;
}

async function jitter(minMs: number, maxMs: number) {
  await new Promise((r) => setTimeout(r, minMs + Math.floor(Math.random() * (maxMs - minMs))));
}

function escaparHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export const solicitarRedefinicaoSenha = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    return { email };
  })
  .handler(async ({ data }): Promise<{ mensagem: string }> => {
    const inicio = Date.now();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ipDaRequisicao, auditar } = await import("@/lib/auditoria.server");
    const ip = ipDaRequisicao();
    const resposta = async () => {
      // Tempo de resposta parecido com ou sem conta (o envio do e-mail demora).
      const resto = 900 - (Date.now() - inicio);
      if (resto > 0) await jitter(resto, resto + 300);
      return { mensagem: MSG_PEDIDO_RECEBIDO };
    };

    // Limite por e-mail e por IP (conta também os pedidos de e-mail sem cadastro).
    const umaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [porEmail, porIp] = await Promise.all([
      supabaseAdmin
        .from("senha_redefinicao")
        .select("id", { count: "exact", head: true })
        .eq("email", data.email)
        .gte("criado_em", umaHora),
      ip === "desconhecido"
        ? Promise.resolve({ count: 0 })
        : supabaseAdmin
            .from("senha_redefinicao")
            .select("id", { count: "exact", head: true })
            .eq("ip", ip)
            .gte("criado_em", umaHora),
    ]);
    if ((porEmail.count ?? 0) >= LIMITE_EMAIL_HORA || (porIp.count ?? 0) >= LIMITE_IP_HORA) {
      console.warn("[redefinir-senha] limite de pedidos atingido");
      return resposta();
    }

    // Conta no app ativa?
    const { data: uid } = await supabaseAdmin.rpc("auth_id_por_email", { p_email: data.email });
    const { data: membro } = uid
      ? await supabaseAdmin
          .from("usuarios")
          .select("id, nome, ativo, imobiliaria_id, imobiliaria:imobiliarias(ativo, nome)")
          .eq("id", uid as string)
          .maybeSingle()
      : { data: null };
    const ativo = !!membro && membro.ativo !== false && membro.imobiliaria?.ativo !== false;

    if (!ativo || !membro) {
      await supabaseAdmin.from("senha_redefinicao").insert({ email: data.email, ip });
      return resposta();
    }

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("base64url");
    const expira = new Date(Date.now() + VALIDADE_MIN * 60 * 1000);
    const { data: pedido, error: insErr } = await supabaseAdmin
      .from("senha_redefinicao")
      .insert({
        user_id: membro.id,
        email: data.email,
        token_hash: await sha256(token),
        ip,
        expira_em: expira.toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !pedido) {
      console.error("[redefinir-senha] gravar pedido:", insErr?.message);
      return resposta();
    }

    const origem = await origemDoPortal();
    let enviado = false;
    let motivo: string | null = null;
    if (!origem) {
      motivo = "origem do portal não configurada (APP_URL)";
    } else {
      try {
        const { remetenteEmailPronto } = await import("@/lib/regua/envio.server");
        const { enviarEmail } = await import("@/lib/integracoes/email.server");
        const r = await remetenteEmailPronto(membro.imobiliaria_id, { exigirAtivo: false });
        const link = `${origem}/redefinir-senha?token=${encodeURIComponent(token)}`;
        const nome = escaparHtml(membro.nome || "");
        const texto =
          `Olá${membro.nome ? `, ${membro.nome}` : ""}.\n\n` +
          `Recebemos um pedido para redefinir a sua senha do Disparo de Cobranças e Documentos.\n` +
          `Abra o link abaixo em até ${VALIDADE_MIN} minutos:\n\n${link}\n\n` +
          `A mesma conta também é usada no ImobSystem, Imobsuprimentos e ImobDoces.\n` +
          `Se não foi você, ignore este e-mail: a senha atual continua valendo.`;
        const html =
          `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.5">` +
          `<p>Olá${nome ? `, ${nome}` : ""}.</p>` +
          `<p>Recebemos um pedido para redefinir a sua senha do <b>Disparo de Cobranças e Documentos</b>.</p>` +
          `<p><a href="${escaparHtml(link)}" style="display:inline-block;background:#0e5c4a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Redefinir senha</a></p>` +
          `<p style="font-size:12px;color:#6b7280">O link vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez. ` +
          `A mesma conta também é usada no ImobSystem, Imobsuprimentos e ImobDoces.<br>` +
          `Se não foi você, ignore este e-mail: a senha atual continua valendo.</p></div>`;
        const res = await enviarEmail(r.provedor, r.credencial, {
          from: r.from,
          fromEmail: r.fromEmail,
          fromNome: r.fromNome,
          replyTo: r.replyTo,
          to: data.email,
          assunto: "Redefinição de senha — Disparo de Cobranças e Documentos",
          html,
          texto,
        });
        enviado = res.ok;
        if (!res.ok) motivo = res.erro ?? "falha no provedor de e-mail";
      } catch (e) {
        motivo = e instanceof Error ? e.message : String(e);
      }
    }
    if (!enviado) console.error("[redefinir-senha] e-mail não enviado:", motivo);

    await auditar({
      userId: membro.id,
      acao: enviado ? "senha_redefinicao_solicitada" : "senha_redefinicao_falhou",
      entidade: "usuario",
      entidadeId: membro.id,
      detalhes: { email: data.email, enviado, motivo },
    });
    return resposta();
  });

export const conferirLinkRedefinicao = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({
    token: String(input?.token ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<{ valido: boolean; email: string | null }> => {
    if (data.token.length < 20) return { valido: false, email: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("senha_redefinicao")
      .select("email, expira_em, usado_em")
      .eq("token_hash", await sha256(data.token))
      .maybeSingle();
    const valido =
      !!p && !p.usado_em && !!p.expira_em && new Date(p.expira_em).getTime() > Date.now();
    return { valido, email: valido ? p!.email : null };
  });

export const redefinirSenhaComToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; novaSenha: string }) => {
    const token = String(input?.token ?? "").slice(0, 200);
    const novaSenha = typeof input?.novaSenha === "string" ? input.novaSenha.slice(0, 128) : "";
    if (token.length < 20) throw new Error(MSG_LINK_INVALIDO);
    exigirPoliticaSenha(novaSenha);
    return { token, novaSenha };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditar } = await import("@/lib/auditoria.server");

    // Consome o token de forma atômica: só um pedido consegue marcar usado_em.
    const agora = new Date().toISOString();
    const { data: p } = await supabaseAdmin
      .from("senha_redefinicao")
      .update({ usado_em: agora })
      .eq("token_hash", await sha256(data.token))
      .is("usado_em", null)
      .gt("expira_em", agora)
      .select("id, user_id, email")
      .maybeSingle();
    if (!p?.user_id) throw new Error(MSG_LINK_INVALIDO);

    const { data: membro } = await supabaseAdmin
      .from("usuarios")
      .select("ativo, imobiliaria:imobiliarias(ativo)")
      .eq("id", p.user_id)
      .maybeSingle();
    if (!membro || membro.ativo === false || membro.imobiliaria?.ativo === false) {
      throw new Error(
        "Sua conta não tem acesso a este portal. Fale com o administrador do sistema.",
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(p.user_id, {
      password: data.novaSenha,
    });
    if (error) {
      console.error("[redefinir-senha] updateUserById:", error.message);
      // Senha recusada pelo Auth (ex.: vazada/fraca): devolve o link para tentar de novo.
      await supabaseAdmin.from("senha_redefinicao").update({ usado_em: null }).eq("id", p.id);
      throw new Error("Não foi possível gravar a nova senha. Tente outra senha.");
    }

    // Outros links pendentes deixam de valer; sessões abertas caem; bloqueio por tentativas é zerado.
    await supabaseAdmin
      .from("senha_redefinicao")
      .update({ usado_em: agora })
      .eq("user_id", p.user_id)
      .is("usado_em", null);
    const revog = await supabaseAdmin.rpc("auth_revogar_sessoes", {
      p_user_id: p.user_id,
      p_manter_sessao: null,
    });
    if (revog.error) console.error("[redefinir-senha] auth_revogar_sessoes:", revog.error.message);
    const desb = await supabaseAdmin.rpc("auth_desbloquear", {
      p_email: p.email,
      p_user_id: p.user_id,
    });
    if (desb.error) console.error("[redefinir-senha] auth_desbloquear:", desb.error.message);
    const { error: flagErr } = await supabaseAdmin
      .from("usuarios")
      .update({ trocar_senha: false })
      .eq("id", p.user_id);
    if (flagErr) console.error("[redefinir-senha] liberar troca:", flagErr.message);

    await auditar({
      userId: p.user_id,
      acao: "senha_redefinida",
      entidade: "usuario",
      entidadeId: p.user_id,
      detalhes: { via: "esqueceu_a_senha", sessoes_revogadas: revog.error ? null : revog.data },
    });
    return { ok: true };
  });
