import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirAal2, exigirPapel, type ContextoAutenticado } from "@/lib/authz";
import { NIVEIS, NIVEL_LABEL, PAPEL_DO_NIVEL, nivelDosPapeis, type Nivel } from "@/lib/permissoes";
import { dominiosPermitidos, emailDeDominioPermitido, gerarSenhaInicial } from "@/lib/senha";

// Administração › Usuários — mesmo modelo do Portal DP e do Gestão de Contratos:
//   · o Super Admin cria a conta; a senha inicial é GERADA pelo servidor (aleatória, 16 caracteres),
//     mostrada uma única vez, e a pessoa é obrigada a trocá-la no primeiro acesso;
//   · "Gerar nova senha" faz o mesmo para uma conta existente, derruba todas as sessões dela e volta
//     a exigir a troca;
//   · só e-mails dos domínios em EMAIL_DOMINIOS_PERMITIDOS (padrão calper.com.br; "*" libera todos);
//   · desativar tira o acesso sem apagar a conta; o portal nunca fica sem um Super Admin ativo.

export type UsuarioPortal = {
  id: string;
  nome: string;
  email: string;
  nivel: Nivel | null;
  ativo: boolean;
  trocar_senha: boolean;
  /** Conta bloqueada por excesso de tentativas de login até este instante (ISO), ou null. */
  bloqueado_ate: string | null;
  created_at: string;
};

async function exigirSuperAdmin(context: unknown) {
  await exigirPapel(context as ContextoAutenticado, ["super_admin"], "Só um Super Admin pode gerenciar usuários.");
  await exigirAal2(context as ContextoAutenticado); // segundo fator (TOTP) obrigatório para gerir usuários
}

function exigirDominioPermitido(email: string) {
  const dominios = dominiosPermitidos(process.env.EMAIL_DOMINIOS_PERMITIDOS);
  if (!emailDeDominioPermitido(email, dominios)) {
    throw new Error(`Só e-mails dos domínios ${dominios.map((d) => "@" + d).join(", ")} podem ser cadastrados.`);
  }
}

/** Derruba todas as sessões da pessoa (todos os navegadores e sistemas Calper). */
async function revogarSessoes(userId: string): Promise<number | null> {
  const sb = await admin();
  const { data, error } = await sb.rpc("auth_revogar_sessoes", { p_user_id: userId, p_manter_sessao: null });
  if (error) {
    console.error("[usuarios] auth_revogar_sessoes:", error.message);
    return null;
  }
  return data;
}

function validarNivel(nivel: unknown): Nivel {
  if (!NIVEIS.includes(nivel as Nivel)) throw new Error("Perfil de acesso inválido.");
  return nivel as Nivel;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Detalhe do PostgREST/GoTrue só no log do servidor; o navegador recebe a mensagem genérica
// (auditoria, Fase 3 / N10). Import dinâmico: *.functions.ts também vai para o bundle do navegador.
async function erroGenerico(origem: string, erro: unknown, mensagem: string): Promise<Error> {
  return (await import("@/lib/erros.server")).erroGenerico(origem, erro, mensagem);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validarUserId(userId: unknown): string {
  if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new Error("Usuário inválido.");
  return userId;
}

/** O alvo precisa ter linha em wa_project_users: a conta de login é compartilhada com outros sistemas Calper. */
async function exigirMembroDoPortal(userId: string) {
  const sb = await admin();
  const { data, error } = await sb.from("wa_project_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw await erroGenerico("usuarios.membro", error, "Não foi possível validar o usuário.");
  if (!data) throw new Error("Usuário não pertence a este portal.");
}

async function auditar(context: ContextoAutenticado, acao: string, entidadeId: string, detalhes: Record<string, unknown>) {
  const { auditar: gravar } = await import("@/lib/auditoria.server");
  await gravar({ userId: context.userId, acao, entidade: "usuario", entidadeId, detalhes });
}

async function papeisDe(userId: string): Promise<string[]> {
  const sb = await admin();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

async function definirNivel(userId: string, nivel: Nivel) {
  const sb = await admin();
  // Só os papéis deste portal: a conta é compartilhada com outros sistemas Calper (papel "cliente" etc.).
  await sb.from("user_roles").delete().eq("user_id", userId).in("role", ["super_admin", "admin", "operadora"]);
  const { error } = await sb.from("user_roles").insert({ user_id: userId, role: PAPEL_DO_NIVEL[nivel] });
  if (error) throw await erroGenerico("usuarios.definirNivel", error, "Não foi possível gravar o perfil.");
}

/** O portal precisa de pelo menos um Super Admin ativo além de `exceto`. */
async function garantirOutroSuperAdmin(exceto: string) {
  const sb = await admin();
  const { data: supers } = await sb.from("user_roles").select("user_id").eq("role", "super_admin").neq("user_id", exceto);
  const ids = (supers ?? []).map((s) => s.user_id);
  if (ids.length) {
    const { data: membros } = await sb.from("wa_project_users").select("user_id, ativo").in("user_id", ids);
    const inativos = new Set((membros ?? []).filter((m) => m.ativo === false).map((m) => m.user_id));
    if (ids.some((id) => !inativos.has(id))) return;
  }
  throw new Error("O portal precisa de pelo menos um Super Admin ativo.");
}

type Membro = { user_id: string; ativo: boolean; trocar_senha?: boolean; created_at: string };

/** Membros do portal; antes da migração 20260930100000 a coluna trocar_senha ainda não existe. */
async function lerMembros(): Promise<Membro[]> {
  const sb = await admin();
  const r = await sb.from("wa_project_users").select("user_id, ativo, trocar_senha, created_at");
  if (!r.error) return (r.data ?? []) as Membro[];
  if (!/trocar_senha/.test(r.error.message)) throw await erroGenerico("usuarios.lerMembros", r.error, "Não foi possível carregar os usuários.");
  const semColuna = await sb.from("wa_project_users").select("user_id, ativo, created_at");
  if (semColuna.error) throw await erroGenerico("usuarios.lerMembros", semColuna.error, "Não foi possível carregar os usuários.");
  return (semColuna.data ?? []) as Membro[];
}

/** Grava ativo/troca de senha do membro (cria a linha se a pessoa só tinha o papel). */
async function gravarMembro(userId: string, campos: { ativo?: boolean; trocar_senha?: boolean }, autor?: string) {
  const sb = await admin();
  const linha = { user_id: userId, ...campos, ...(autor ? { adicionado_por: autor } : {}) };
  let { error } = await sb.from("wa_project_users").upsert(linha, { onConflict: "user_id" });
  if (error && /trocar_senha/.test(error.message)) {
    if (campos.trocar_senha) {
      throw new Error(
        "A troca de senha obrigatória ainda não está disponível no banco. Rode a migração 20260930100000_troca_senha_obrigatoria.sql no Supabase.",
      );
    }
    const { trocar_senha: _ignorado, ...semTroca } = linha;
    ({ error } = await sb.from("wa_project_users").upsert(semTroca, { onConflict: "user_id" }));
  }
  if (error) throw await erroGenerico("usuarios.gravarMembro", error, "Não foi possível gravar o acesso.");
}

export const listarUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioPortal[]> => {
    await exigirSuperAdmin(context);
    const sb = await admin();

    // Usuários do portal: membros do projeto + quem tem papel de trabalho (Super Admin, Admin, Analista).
    // Contas só com "cliente" são de outros sistemas no mesmo Supabase e ficam fora da lista.
    const [membros, papeisTrabalho] = await Promise.all([
      lerMembros(),
      sb.from("user_roles").select("user_id").in("role", ["super_admin", "admin", "operadora"]),
    ]);
    if (papeisTrabalho.error) throw await erroGenerico("usuarios.listar", papeisTrabalho.error, "Não foi possível carregar os usuários.");
    const membroPorId = new Map(membros.map((m) => [m.user_id, m]));
    const ids = [...new Set([...membroPorId.keys(), ...(papeisTrabalho.data ?? []).map((r) => r.user_id)])];
    if (!ids.length) return [];

    const [perfis, papeis] = await Promise.all([
      sb.from("profiles").select("id, full_name, email, created_at").in("id", ids),
      sb.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);
    if (perfis.error) throw await erroGenerico("usuarios.listar", perfis.error, "Não foi possível carregar os usuários.");
    if (papeis.error) throw await erroGenerico("usuarios.listar", papeis.error, "Não foi possível carregar os usuários.");
    const perfilPorId = new Map((perfis.data ?? []).map((p) => [p.id, p]));

    // Bloqueio por tentativas de login (migração 20261001120000) — por conta e pelo hook do Auth.
    const bloqueios = await Promise.all(
      ids.map(async (id) => {
        const email = perfilPorId.get(id)?.email ?? "";
        const { data } = await sb.rpc("auth_bloqueio_de", { p_email: email, p_user_id: id });
        return [id, (data as string | null) ?? null] as const;
      }),
    );
    const bloqueioPorId = new Map<string, string | null>(bloqueios);

    return ids
      .map((id) => {
        const p = perfilPorId.get(id);
        const m = membroPorId.get(id);
        const roles = (papeis.data ?? []).filter((r) => r.user_id === id).map((r) => r.role as string);
        return {
          id,
          nome: p?.full_name ?? p?.email ?? "",
          email: p?.email ?? "",
          nivel: nivelDosPapeis(roles),
          ativo: m ? m.ativo !== false : true,
          trocar_senha: m?.trocar_senha === true,
          bloqueado_ate: bloqueioPorId.get(id) ?? null,
          created_at: m?.created_at ?? p?.created_at ?? "",
        };
      })
      .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  });

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { nome: string; email: string; nivel: Nivel; ativo: boolean }) => {
    const email = String(input.email ?? "").trim().toLowerCase();
    const nome = String(input.nome ?? "").trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if (nome.length < 2 || nome.length > 120) throw new Error("Informe o nome (até 120 caracteres).");
    return { email, nome, nivel: validarNivel(input.nivel), ativo: input.ativo !== false };
  })
  .handler(async ({ data, context }): Promise<{ id: string; senhaInicial?: string; aviso?: string }> => {
    await exigirSuperAdmin(context);
    exigirDominioPermitido(data.email);
    const sb = await admin();
    const senhaInicial = gerarSenhaInicial();

    // Conta já existente no Auth (o projeto Supabase é compartilhado com outros sistemas Calper):
    // só vincula ao portal. A senha e o nome que a pessoa já tem são mantidos — redefini-los aqui
    // derrubaria o acesso dela aos outros sistemas; a troca de senha é exigida no primeiro acesso.
    const { data: existente } = await sb.from("profiles").select("id").eq("email", data.email).maybeSingle();
    let userId = existente?.id as string | undefined;
    const vinculada = !!userId;
    if (userId) {
      const { data: jaMembro } = await sb.from("wa_project_users").select("user_id").eq("user_id", userId).maybeSingle();
      if (jaMembro) throw new Error("Já existe um usuário com este e-mail.");
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

    if (vinculada) {
      // Garante o perfil sem sobrescrever o nome já cadastrado.
      await sb.from("profiles").upsert({ id: userId, email: data.email }, { onConflict: "id", ignoreDuplicates: true });
    } else {
      await sb.from("profiles").upsert({ id: userId, email: data.email, full_name: data.nome });
    }
    await gravarMembro(userId!, { ativo: data.ativo, trocar_senha: true }, (context as ContextoAutenticado).userId);
    await definirNivel(userId, data.nivel);

    await auditar(context as ContextoAutenticado, vinculada ? "usuario_vinculado" : "usuario_criado", userId, {
      email: data.email,
      perfil: NIVEL_LABEL[data.nivel],
      ativo: data.ativo,
    });
    if (vinculada) {
      return {
        id: userId,
        aviso: "Conta já existia em outro sistema Calper; a senha atual foi mantida e a troca será exigida no primeiro acesso.",
      };
    }
    // A senha inicial só existe nesta resposta: não é gravada nem auditada.
    return { id: userId, senhaInicial };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; nome: string; nivel: Nivel; ativo: boolean; trocar_senha: boolean }) => {
    const userId = validarUserId(input.userId);
    const nome = String(input.nome ?? "").trim();
    if (nome.length < 2 || nome.length > 120) throw new Error("Informe o nome (até 120 caracteres).");
    return { userId, nome, nivel: validarNivel(input.nivel), ativo: input.ativo !== false, trocar_senha: !!input.trocar_senha };
  })
  .handler(async ({ data, context }) => {
    await exigirSuperAdmin(context);
    const sb = await admin();
    const ctx = context as ContextoAutenticado;
    const proprio = data.userId === ctx.userId;
    await exigirMembroDoPortal(data.userId);

    const eraSuper = (await papeisDe(data.userId)).includes("super_admin");
    const continuaSuper = data.nivel === "superadmin" && data.ativo;
    if (proprio && (!continuaSuper || data.trocar_senha)) {
      throw new Error("Você não pode rebaixar, desativar ou exigir troca de senha do próprio usuário.");
    }
    if (eraSuper && !continuaSuper) await garantirOutroSuperAdmin(data.userId);

    await sb.from("profiles").update({ full_name: data.nome }).eq("id", data.userId);
    await gravarMembro(data.userId, data.trocar_senha ? { ativo: data.ativo, trocar_senha: true } : { ativo: data.ativo, trocar_senha: false });
    await definirNivel(data.userId, data.nivel);

    await auditar(ctx, "usuario_alterado", data.userId, {
      nome: data.nome,
      perfil: NIVEL_LABEL[data.nivel],
      ativo: data.ativo,
      troca_de_senha_exigida: data.trocar_senha,
    });
    return { ok: true };
  });

export const definirSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: validarUserId(input?.userId) }))
  .handler(async ({ data, context }): Promise<{ ok: true; senhaInicial: string; sessoes_revogadas: number | null }> => {
    await exigirSuperAdmin(context);
    const ctx = context as ContextoAutenticado;
    if (data.userId === ctx.userId) throw new Error("Para trocar a sua própria senha, use a tela de troca de senha.");
    const sb = await admin();
    // Só usuários deste portal: a conta de login é compartilhada com outros sistemas Calper.
    const [membro, papeis] = await Promise.all([
      sb.from("wa_project_users").select("user_id").eq("user_id", data.userId).maybeSingle(),
      papeisDe(data.userId),
    ]);
    if (!membro.data && !papeis.some((r) => ["super_admin", "admin", "operadora"].includes(r))) {
      throw new Error("Este usuário não faz parte do portal Disparo em Massa.");
    }
    const senhaInicial = gerarSenhaInicial();
    const { error } = await sb.auth.admin.updateUserById(data.userId, { password: senhaInicial });
    if (error) {
      console.error("[usuarios] updateUserById:", error.message);
      throw new Error("Não foi possível definir a senha.");
    }
    await gravarMembro(data.userId, { trocar_senha: true });
    const sessoes_revogadas = await revogarSessoes(data.userId);
    await auditar(ctx, "senha_definida", data.userId, { troca_exigida: true, sessoes_revogadas });
    // A senha só existe nesta resposta: não é gravada nem auditada.
    return { ok: true, senhaInicial, sessoes_revogadas };
  });

/** Libera uma conta bloqueada por excesso de tentativas de login (bloqueio por conta; o de IP expira sozinho). */
export const desbloquearUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: validarUserId(input.userId) }))
  .handler(async ({ data, context }) => {
    await exigirSuperAdmin(context);
    const ctx = context as ContextoAutenticado;
    const sb = await admin();
    await exigirMembroDoPortal(data.userId);
    const { data: perfil } = await sb.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    const { error } = await sb.rpc("auth_desbloquear", { p_email: perfil?.email ?? "", p_user_id: data.userId });
    if (error) {
      console.error("[usuarios] auth_desbloquear:", error.message);
      throw new Error("Não foi possível desbloquear a conta.");
    }
    await auditar(ctx, "conta_desbloqueada", data.userId, { email: perfil?.email ?? null });
    return { ok: true };
  });
