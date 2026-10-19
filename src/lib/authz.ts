// Checagem de acesso nas server functions, com o token do usuário (contexto do middleware requireSupabaseAuth).
//
// Fonte: imobenviomassa.meu_acesso(), que só devolve linha se o usuário estiver ativo, numa imobiliária ativa e
// liberado na Central de acessos do ikvj. Conta com troca de senha pendente não tem papel nenhum — só troca a senha.
// Os papéis antigos continuam valendo nas chamadas: "super_admin" e "admin" são os perfis de mesmo nome;
// "operadora" é qualquer usuário com acesso (Analista ou perfis criados na tela Perfis e permissões).

import type { PermissionId } from "@/config/menu-registry";
import { computePermissions, type Regras } from "@/lib/acesso/policy";

export type Papel = "super_admin" | "admin" | "operadora";

export type ContextoAutenticado = {
  supabase: any;
  userId: string;
  /** Claims do JWT (middleware requireSupabaseAuth → `data.claims`). */
  claims?: Record<string, unknown>;
};

export type AcessoDoUsuario = {
  imobiliariaId: string;
  imobiliariaNome: string;
  perfil: string;
  perfilNome: string;
  trocarSenha: boolean;
  regras: Regras;
};

const cache = new WeakMap<ContextoAutenticado, Promise<AcessoDoUsuario | null>>();

/** Acesso do usuário logado; null = sem cadastro, inativo, imobiliária inativa ou bloqueado na Central. */
export function acessoDoUsuario(context: ContextoAutenticado): Promise<AcessoDoUsuario | null> {
  let p = cache.get(context);
  if (!p) {
    p = (async () => {
      const { data, error } = await context.supabase.rpc("meu_acesso");
      if (error) {
        // Detalhe do PostgREST só no log (erros.server é *.server.ts: import dinâmico, pois este módulo é
        // importado estaticamente pelos *.functions.ts, que vão para o bundle do navegador).
        const { erroGenerico } = await import("@/lib/erros.server");
        throw erroGenerico("authz.acessoDoUsuario", error, "Falha ao validar o acesso.");
      }
      const linha = Array.isArray(data) ? data[0] : data;
      if (!linha || linha.ativo === false) return null;
      return {
        imobiliariaId: linha.imobiliaria_id,
        imobiliariaNome: linha.imobiliaria_nome,
        perfil: linha.perfil,
        perfilNome: linha.perfil_nome,
        trocarSenha: linha.trocar_senha === true,
        regras: (linha.regras ?? {}) as Regras,
      };
    })();
    cache.set(context, p);
  }
  return p;
}

/** Imobiliária do usuário (tenant) para filtrar as consultas feitas com a service_role. Lança se não houver. */
export async function imobiliariaDoContexto(context: ContextoAutenticado): Promise<string> {
  const acesso = await acessoDoUsuario(context);
  if (!acesso || acesso.trocarSenha) throw new Error("Seu acesso não está liberado.");
  return acesso.imobiliariaId;
}

export async function temPapel(context: ContextoAutenticado, papeis: Papel[]): Promise<boolean> {
  const acesso = await acessoDoUsuario(context);
  if (!acesso || acesso.trocarSenha) return false;
  if (papeis.includes("operadora")) return true;
  return papeis.includes(acesso.perfil as Papel);
}

/** Lança erro se o usuário não tiver nenhum dos papéis. */
export async function exigirPapel(
  context: ContextoAutenticado,
  papeis: Papel[],
  mensagem = "Seu perfil não tem acesso a esta operação.",
): Promise<void> {
  if (!(await temPapel(context, papeis))) throw new Error(mensagem);
}

/** Permissão do menu-registry (mesma regra do front: src/lib/acesso/policy.ts). */
export async function temPermissao(
  context: ContextoAutenticado,
  id: PermissionId,
): Promise<boolean> {
  const acesso = await acessoDoUsuario(context);
  if (!acesso || acesso.trocarSenha) return false;
  return computePermissions(acesso.perfil, acesso.regras, false)[id] === true;
}

export async function exigirPermissao(
  context: ContextoAutenticado,
  id: PermissionId,
  mensagem = "Seu perfil não tem acesso a esta operação.",
): Promise<void> {
  if (!(await temPermissao(context, id))) throw new Error(mensagem);
}

/** Só o Super Admin (credenciais das integrações, usuários e operações irreversíveis da LGPD). */
export async function exigirSuperAdmin(
  context: ContextoAutenticado,
  mensagem = "Só o Super Admin faz esta operação.",
): Promise<void> {
  await exigirPapel(context, ["super_admin"], mensagem);
}
