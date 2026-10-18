// Checagem de papel nas server functions (RPC has_role, com o token do usuário).
// O contexto vem do middleware requireSupabaseAuth.
//
// Mesmo modelo do Portal DP / Gestão de Contratos: conta inativa ou com troca de senha pendente não
// tem nenhum papel — só consegue trocar a senha.

import { APP_KEY } from "@/lib/app-key";

export type Papel = "super_admin" | "admin" | "operadora" | "cliente";

export type ContextoAutenticado = {
  supabase: any;
  userId: string;
  /** Claims do JWT (middleware requireSupabaseAuth → `data.claims`); `aal` indica o nível MFA da sessão. */
  claims?: Record<string, unknown> & { aal?: string };
};

/**
 * Conta ativa no projeto e sem troca de senha pendente. Todo usuário do portal tem linha em
 * wa_project_users: sem linha, sem acesso; erro na consulta, sem acesso (fail closed).
 */
async function contaLiberada(context: ContextoAutenticado): Promise<boolean> {
  const { data, error } = await context.supabase
    .from("wa_project_users")
    .select("ativo, trocar_senha")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) {
    // Detalhe do PostgREST só no log (erros.server é *.server.ts: import dinâmico, pois este
    // módulo é importado estaticamente pelos *.functions.ts, que vão para o bundle do navegador).
    const { erroGenerico } = await import("@/lib/erros.server");
    throw erroGenerico("authz.contaLiberada", error, "Falha ao validar o acesso.");
  }
  if (!data) return false;
  if (data.ativo === false || data.trocar_senha === true) return false;
  return appLiberadoNaCentral(context);
}

/**
 * Central de acessos Calper (Permissões por aplicativo): só um `false` explícito bloqueia — função
 * inexistente ou falha não barram, como no Gestão de Contratos. A chave está em src/lib/app-access.ts.
 */
async function appLiberadoNaCentral(context: ContextoAutenticado): Promise<boolean> {
  try {
    const { data, error } = await context.supabase.rpc("pode_acessar_app", { p_app: APP_KEY });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export async function temPapel(context: ContextoAutenticado, papeis: Papel[]): Promise<boolean> {
  const [liberada, ...resultados] = await Promise.all([
    contaLiberada(context),
    ...papeis.map((p) => context.supabase.rpc("has_role", { _user_id: context.userId, _role: p })),
  ]);
  const erro = resultados.find((r: any) => r.error)?.error;
  if (erro) {
    const { erroGenerico } = await import("@/lib/erros.server");
    throw erroGenerico("authz.temPapel", erro, "Falha ao validar permissão.");
  }
  return liberada && resultados.some((r: any) => r.data === true);
}

/** Lança erro se o usuário não tiver nenhum dos papéis. */
export async function exigirPapel(
  context: ContextoAutenticado,
  papeis: Papel[],
  mensagem = "Seu perfil não tem acesso a esta operação.",
): Promise<void> {
  if (!(await temPapel(context, papeis))) throw new Error(mensagem);
}

export const MSG_EXIGE_MFA =
  "Esta operação exige a verificação em duas etapas. Ative em Minha conta → Segurança e entre novamente.";

/**
 * Exige sessão com 2º fator verificado (claim `aal` = "aal2" no JWT). O nível vem do próprio token
 * emitido pelo GoTrue após mfa.verify — o cliente não consegue forjá-lo. Sem claims = sem acesso.
 */
export async function exigirAal2(context: ContextoAutenticado, mensagem = MSG_EXIGE_MFA): Promise<void> {
  if (context.claims?.aal !== "aal2") throw new Error(mensagem);
}

/** Super Admin com MFA: papel super_admin + sessão em aal2 (operações sensíveis: credenciais e usuários). */
export async function exigirSuperAdminComMfa(context: ContextoAutenticado): Promise<void> {
  await exigirPapel(context, ["super_admin"]);
  await exigirAal2(context);
}
