// Permissões por aplicativo (Central de acessos Calper) — mesma regra do Gestão de Contratos, do
// Gestão Comercial, do Financeiro e do Portal DP. Depois do login o portal pergunta ao banco se a
// pessoa pode entrar no Disparo em Massa. A regra é única para todos os aplicativos do projeto
// Supabase (schema "acessos"): proprietário → decisão manual do Super admin da Central → cadastro
// próprio → padrão. Com o controle desligado na Central, todos entram.
//
// Duas travas, como no contratos: a da Central e a do próprio portal (wa_project_users ativo + perfil).
import { supabase } from "@/integrations/supabase/client";

import { APP_KEY } from "@/lib/app-key";

export { APP_KEY };

export const APP_ACCESS_DENIED_MESSAGE = "Sem permissão nessa aplicação, contacte o Administrador.";

/** Evento que abre o pop-up de bloqueio (AppAccessDenied, montado no __root). */
export const APP_ACCESS_DENIED_EVENT = "calper:app-access-denied";

export function notificarAcessoNegado() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(APP_ACCESS_DENIED_EVENT));
}

// As RPCs da Central não estão no types.ts gerado deste projeto.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

/**
 * `true` = pode entrar. Só um `false` explícito do banco bloqueia: função ainda não criada ou falha
 * de rede não barram ninguém — o portal tem as próprias travas (wa_project_users, perfis, RLS).
 */
export async function podeAcessarEsteApp(): Promise<boolean> {
  try {
    const { data, error } = await rpc("pode_acessar_app", { p_app: APP_KEY });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** Super admin da Central (super_admin no Gestão Comercial): só ele vê "Permissões por aplicativo". */
export async function souSuperAdminCentral(): Promise<boolean> {
  try {
    const { data, error } = await rpc("pa_sou_super_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Confere a Central; se bloqueado, encerra a sessão e abre o pop-up. Devolve true quando pode seguir. */
export async function conferirAcessoApp(): Promise<boolean> {
  if (await podeAcessarEsteApp()) return true;
  await supabase.auth.signOut();
  notificarAcessoNegado();
  return false;
}
