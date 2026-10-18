// Permissões por aplicativo (Central de acessos do Supabase ImobSystem, schema "acessos") — a mesma do
// ImobSystem, do Imobsuprimentos e do ImobDoces. Depois do login o portal pergunta ao banco se a pessoa pode
// entrar. Regra: conta proprietária → decisão manual do super admin → cadastro no app → padrão. Com o
// controle desligado na Central, todos entram.
//
// Duas travas: a da Central e a do próprio app (imobenviomassa.usuarios ativo + perfil). A da Central também
// vale na RLS: imobenviomassa.tenant_atual() chama acessos.eu_posso.
import { supabase } from "@/integrations/supabase/client";

import { APP_KEY } from "@/lib/app-key";

export { APP_KEY };

export const APP_ACCESS_DENIED_MESSAGE = "Sem permissão nessa aplicação, contacte o Administrador.";

/** Evento que abre o pop-up de bloqueio (AppAccessDenied, montado no __root). */
export const APP_ACCESS_DENIED_EVENT = "calper:app-access-denied";

export function notificarAcessoNegado() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(APP_ACCESS_DENIED_EVENT));
}

// As RPCs da Central ficam no schema public (o cliente usa o schema imobenviomassa por padrão).
const central = () => supabase.schema("public");
const rpc = ((fn: string, args?: Record<string, unknown>) => central().rpc(fn as never, args as never)) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

/**
 * `true` = pode entrar. Só um `false` explícito do banco bloqueia: função ainda não criada ou falha
 * de rede não barram ninguém — o app tem as próprias travas (usuarios, perfis, RLS).
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

/** Super admin da Central (conta proprietária da WSA): só ele vê "Permissões por aplicativo". */
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
