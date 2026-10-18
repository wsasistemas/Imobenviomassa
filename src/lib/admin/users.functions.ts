import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { acessoDoUsuario, exigirAal2, exigirPermissao, type ContextoAutenticado } from "@/lib/authz";
import { dominiosPermitidos, emailDeDominioPermitido, gerarSenhaInicial } from "@/lib/senha";

// Configurações › Usuários (por imobiliária):
//   · quem tem a permissão "Usuários" (manage_users) e a verificação em duas etapas cadastra, altera e gera senha;
//   · a senha inicial é GERADA pelo servidor (aleatória), mostrada uma única vez, e a troca é exigida no 1º acesso;
//   · "Gerar nova senha" faz o mesmo para uma conta existente e derruba todas as sessões dela;
//   · o perfil vem da tela Perfis e permissões (os 3 do sistema + os criados na imobiliária). Só um Super Admin
//     atribui ou altera um Super Admin; a imobiliária nunca fica sem um Super Admin ativo;
//   · o login do ikvj é compartilhado (ImobSystem, Imobsuprimentos, ImobDoces): conta que já existe só é vinculada,
//     sem trocar a senha que a pessoa usa nos outros sistemas;
//   · e-mails só dos domínios em EMAIL_DOMINIOS_PERMITIDOS ("*" libera todos).

export type UsuarioPortal = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  perfil_nome: string;
  ativo: boolean;
  trocar_senha: boolean;
  /** Conta bloqueada por excesso de tentativas de login até este instante (ISO), ou null. */
  bloqueado_ate: string | null;
  ultimo_acesso: string | null;
  created_at: string;
};

export type PerfilAtribuivel = { chave: string; nome: string; descricao: string | null; sistema: boolean };

type Gestor = { ctx: ContextoAutenticado; imob: string; souSuper: boolean };

async function exigirGestor(context: unknown): Promise<Gestor> {
  const ctx = context as ContextoAutenticado;
  await exigirPermissao(ctx, "manage_users", "Seu perfil não tem acesso à gestão de usuários.");
  await exigirAal2(ctx); // segundo fator (TOTP) obrigatório para gerir usuários
  const acesso = await acessoDoUsuario(ctx);
  if (!acesso) throw new Error("Seu acesso não está liberado.");
  return { ctx, imob: acesso.imobiliariaId, souSuper: acesso.perfil === "super_admin" };
}

function exigirDominioPermitido(email: string) {
  const dominios = dominiosPermitidos(process.env.EMAIL_DOMINIOS_PERMITIDOS);
  if (!emailDeDominioPermitido(email, dominios)) {
    throw new Error(`Só e-mails dos domínios ${dominios.map((d) => "@" + d).join(", ")} podem ser cadastrados.`);
  }
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Detalhe do PostgREST/GoTrue só no log do servidor; o navegador recebe a mensagem genérica.
// Import dinâmico: *.functions.ts também vai para o bundle do navegador.
async function erroGenerico(origem: string, erro: unknown, mensagem: string): Promise<Error> {
  return (await import("@/lib/erros.server")).erroGenerico(origem, erro, mensagem);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERFIL_RE = /^[a-z0-9_]{2,60}$/;

function validarUserId(userId: unknown): string {
  if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new Error("Usuário inválido.");
  return userId;
}

function validarPerfil(perfil: unknown): string {
  if (typeof perfil !== "string" || !PERFIL_RE.test(perfil)) throw new Error("Perfil de acesso inválido.");
  return perfil;
}

/** Perfis que a imobiliária pode usar: os 3 do sistema + os criados nela. */
async function perfisDaImobiliaria(imob: string): Promise<PerfilAtribuivel[]> {
  const sb = await admin();
  const { data, error } = await sb
    .from("perfis")
    .select("chave, nome, descricao, sistema, ordem, imobiliaria_id")
    .or(`imobiliaria_id.is.null,imobiliaria_id.eq.${imob}`)
    .order("ordem")
    .order("nome");
  if (error) throw await erroGenerico("usuarios.perfis", error, "Não foi possível carregar os perfis.");
  return (data ?? []).map((p) => ({ chave: p.chave, nome: p.nome, descricao: p.descricao, sistema: p.sistema }));
}

/** O perfil existe na imobiliária e o gestor pode atribuí-lo (Super Admin só por outro Super Admin). */
async function exigirPerfilAtribuivel(g: Gestor, perfil: string): Promise<PerfilAtribuivel> {
  const p = (await perfisDaImobiliaria(g.imob)).find((x) => x.chave === perfil);
  if (!p) throw new Error("Perfil de acesso inválido.");
  if (perfil === "super_admin" && !g.souSuper) throw new Error("Só um Super Admin atribui o perfil Super Admin.");
  return p;
}

type Cadastro = { id: string; imobiliaria_id: string; email: string; nome: string | null; perfil: string; ativo: boolean };

/** O alvo precisa ser usuário desta imobiliária; Super Admin só é alterado por outro Super Admin. */
async function exigirUsuarioDaImobiliaria(g: Gestor, userId: string): Promise<Cadastro> {
  const sb = await admin();
  const { data, error } = await sb
    .from("usuarios")
    .select("id, imobiliaria_id, email, nome, perfil, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw await erroGenerico("usuarios.membro", error, "Não foi possível validar o usuário.");
  if (!data || data.imobiliaria_id !== g.imob) throw new Error("Usuário não pertence à sua imobiliária.");
  if (data.perfil === "super_admin" && !g.souSuper && userId !== g.ctx.userId) {
    throw new Error("Só um Super Admin altera outro Super Admin.");
  }
  return data;
}

async function auditar(g: Gestor, acao: string, entidadeId: string, detalhes: Record<string, unknown>) {
  const { auditar: gravar } = await import("@/lib/auditoria.server");
  await gravar({ userId: g.ctx.userId, imobiliariaId: g.imob, acao, entidade: "usuario", entidadeId, detalhes });
}

/** A imobiliária precisa de pelo menos um Super Admin ativo além de `exceto`. */
async function garantirOutroSuperAdmin(imob: string, exceto: string) {
  const sb = await admin();
  const { count } = await sb
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("imobiliaria_id", imob)
    .eq("perfil", "super_admin")
    .eq("ativo", true)
    .neq("id", exceto);
  if (!count) throw new Error("A imobiliária precisa de pelo menos um Super Admin ativo.");
}

/** Derruba todas as sessões da pessoa (todos os navegadores e sistemas do login compartilhado). */
async function revogarSessoes(userId: string): Promise<number | null> {
  const sb = await admin();
  const { data, error } = await sb.rpc("auth_revogar_sessoes", { p_user_id: userId, p_manter_sessao: null });
  if (error) {
    console.error("[usuarios] auth_revogar_sessoes:", error.message);
    return null;
  }
  return data;
}

export const listarPerfisAtribuiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PerfilAtribuivel[]> => {
    const g = await exigirGestor(context);
    const perfis = await perfisDaImobiliaria(g.imob);
    return g.souSuper ? perfis : perfis.filter((p) => p.chave !== "super_admin");
  });

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioPortal[]> => {
    const g = await exigirGestor(context);
    const sb = await admin();
    const [{ data: usuarios, error }, perfis] = await Promise.all([
      sb
        .from("usuarios")
        .select("id, email, nome, perfil, ativo, trocar_senha, ultimo_acesso, criado_em")
        .eq("imobiliaria_id", g.imob),
      perfisDaImobiliaria(g.imob),
    ]);
    if (error) throw await erroGenerico("usuarios.listar", error, "Não foi possível carregar os usuários.");
    const nomePerfil = new Map(perfis.map((p) => [p.chave, p.nome]));

    // Bloqueio por tentativas de login (por conta).
    const bloqueios = await Promise.all(
      (usuarios ?? []).map(async (u) => {
        const { data } = await sb.rpc("auth_bloqueio_de", { p_email: u.email, p_user_id: u.id });
        return [u.id, (data as string | null) ?? null] as const;
      }),
    );
    const bloqueioPorId = new Map<string, string | null>(bloqueios);

    return (usuarios ?? [])
      .map((u) => ({
        id: u.id,
        nome: u.nome ?? u.email,
        email: u.email,
        perfil: u.perfil,
        perfil_nome: nomePerfil.get(u.perfil) ?? u.perfil,
        ativo: u.ativo,
        trocar_senha: u.trocar_senha,
        bloqueado_ate: bloqueioPorId.get(u.id) ?? null,
        ultimo_acesso: u.ultimo_acesso,
        created_at: u.criado_em,
      }))
      .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; email: string; perfil: string; ativo: boolean }) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    const nome = String(input.nome ?? "").trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if (nome.length < 2 || nome.length > 120) throw new Error("Informe o nome (até 120 caracteres).");
    return { email, nome, perfil: validarPerfil(input.perfil), ativo: input.ativo !== false };
  })
  .handler(async ({ data, context }): Promise<{ id: string; senhaInicial?: string; aviso?: string }> => {
    const g = await exigirGestor(context);
    exigirDominioPermitido(data.email);
    const perfil = await exigirPerfilAtribuivel(g, data.perfil);
    const sb = await admin();
    const senhaInicial = gerarSenhaInicial();

    // Conta já existente no login compartilhado: só vincula. A senha e o nome que a pessoa já usa nos outros
    // sistemas são mantidos; a troca de senha é exigida no primeiro acesso a este app.
    const { data: existente, error: errBusca } = await sb.rpc("auth_id_por_email", { p_email: data.email });
    if (errBusca) throw await erroGenerico("usuarios.buscar", errBusca, "Não foi possível verificar o e-mail.");
    let userId = (existente as string | null) ?? undefined;
    const vinculada = !!userId;
    if (userId) {
      const { data: jaCadastrado } = await sb.from("usuarios").select("imobiliaria_id").eq("id", userId).maybeSingle();
      if (jaCadastrado) {
        throw new Error(
          jaCadastrado.imobiliaria_id === g.imob
            ? "Já existe um usuário com este e-mail."
            : "Este e-mail já está cadastrado em outra imobiliária.",
        );
      }
      const { error } = await sb.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) throw await erroGenerico("usuarios.vincular", error, "Não foi possível vincular a conta.");
    } else {
      const { data: criado, error } = await sb.auth.admin.createUser({
        email: data.email,
        password: senhaInicial,
        email_confirm: true,
        user_metadata: { full_name: data.nome },
      });
      if (error || !criado.user) {
        const msg = error?.message ?? "falha desconhecida";
        if (/already been registered|already exists|duplicate/i.test(msg)) throw new Error("Já existe uma conta com este e-mail.");
        throw await erroGenerico("usuarios.criar", error ?? msg, "Não foi possível criar a conta.");
      }
      userId = criado.user.id;
    }

    const { error: errCadastro } = await sb.from("usuarios").insert({
      id: userId,
      imobiliaria_id: g.imob,
      email: data.email,
      nome: data.nome,
      perfil: data.perfil,
      ativo: data.ativo,
      trocar_senha: true,
      adicionado_por: g.ctx.userId,
    });
    if (errCadastro) throw await erroGenerico("usuarios.cadastro", errCadastro, "Não foi possível gravar o usuário.");

    await auditar(g, vinculada ? "usuario_vinculado" : "usuario_criado", userId!, {
      email: data.email,
      perfil: perfil.nome,
      ativo: data.ativo,
    });
    if (vinculada) {
      return {
        id: userId!,
        aviso: "A conta já existia em outro sistema ImobSystem; a senha atual foi mantida e a troca será exigida no primeiro acesso.",
      };
    }
    // A senha inicial só existe nesta resposta: não é gravada nem auditada.
    return { id: userId!, senhaInicial };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; nome: string; perfil: string; ativo: boolean; trocar_senha: boolean }) => {
    const userId = validarUserId(input.userId);
    const nome = String(input.nome ?? "").trim();
    if (nome.length < 2 || nome.length > 120) throw new Error("Informe o nome (até 120 caracteres).");
    return { userId, nome, perfil: validarPerfil(input.perfil), ativo: input.ativo !== false, trocar_senha: !!input.trocar_senha };
  })
  .handler(async ({ data, context }) => {
    const g = await exigirGestor(context);
    const alvo = await exigirUsuarioDaImobiliaria(g, data.userId);
    const proprio = data.userId === g.ctx.userId;
    if (proprio && (data.perfil !== alvo.perfil || !data.ativo || data.trocar_senha)) {
      throw new Error("Você não pode mudar o próprio perfil, se desativar ou exigir troca da própria senha.");
    }
    const perfil = await exigirPerfilAtribuivel(g, data.perfil);
    const continuaSuper = data.perfil === "super_admin" && data.ativo;
    if (alvo.perfil === "super_admin" && alvo.ativo && !continuaSuper) await garantirOutroSuperAdmin(g.imob, data.userId);

    const sb = await admin();
    const { error } = await sb
      .from("usuarios")
      .update({ nome: data.nome, perfil: data.perfil, ativo: data.ativo, trocar_senha: data.trocar_senha })
      .eq("id", data.userId)
      .eq("imobiliaria_id", g.imob);
    if (error) throw await erroGenerico("usuarios.atualizar", error, "Não foi possível gravar o usuário.");

    await auditar(g, "usuario_alterado", data.userId, {
      nome: data.nome,
      perfil: perfil.nome,
      ativo: data.ativo,
      troca_de_senha_exigida: data.trocar_senha,
    });
    return { ok: true };
  });

export const definirSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: validarUserId(input?.userId) }))
  .handler(async ({ data, context }): Promise<{ ok: true; senhaInicial: string; sessoes_revogadas: number | null }> => {
    const g = await exigirGestor(context);
    if (data.userId === g.ctx.userId) throw new Error("Para trocar a sua própria senha, use a tela de troca de senha.");
    await exigirUsuarioDaImobiliaria(g, data.userId);
    const sb = await admin();
    const senhaInicial = gerarSenhaInicial();
    const { error } = await sb.auth.admin.updateUserById(data.userId, { password: senhaInicial });
    if (error) {
      console.error("[usuarios] updateUserById:", error.message);
      throw new Error("Não foi possível definir a senha.");
    }
    await sb.from("usuarios").update({ trocar_senha: true }).eq("id", data.userId);
    const sessoes_revogadas = await revogarSessoes(data.userId);
    await auditar(g, "senha_definida", data.userId, { troca_exigida: true, sessoes_revogadas });
    // A senha só existe nesta resposta: não é gravada nem auditada.
    return { ok: true, senhaInicial, sessoes_revogadas };
  });

/** Libera uma conta bloqueada por excesso de tentativas de login (bloqueio por conta; o de IP expira sozinho). */
export const desbloquearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: validarUserId(input.userId) }))
  .handler(async ({ data, context }) => {
    const g = await exigirGestor(context);
    const alvo = await exigirUsuarioDaImobiliaria(g, data.userId);
    const sb = await admin();
    const { error } = await sb.rpc("auth_desbloquear", { p_email: alvo.email, p_user_id: data.userId });
    if (error) {
      console.error("[usuarios] auth_desbloquear:", error.message);
      throw new Error("Não foi possível desbloquear a conta.");
    }
    await auditar(g, "conta_desbloqueada", data.userId, { email: alvo.email });
    return { ok: true };
  });
