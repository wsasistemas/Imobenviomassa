// Segredos das integrações no Vault do Supabase (só servidor). Nomes: <prefixo>_<item>_<imobiliária sem hífen>,
// com prefixo zenvia_, resend_ ou smtp_ (validação no banco: imobenviomassa.segredo_nome_valido).
// O valor nunca volta para o navegador: as telas só recebem "configurado" (sim/não).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { erroGenerico } from "@/lib/erros.server";

export type Segredo = "zenvia_token" | "zenvia_webhook" | "resend_apikey" | "smtp_senha";

export const nomeSegredo = (s: Segredo, imobiliariaId: string) =>
  `${s}_${imobiliariaId.replace(/-/g, "")}`;

export async function gravarSegredo(
  s: Segredo,
  imobiliariaId: string,
  valor: string,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc("wa_segredo_gravar", {
    p_nome: nomeSegredo(s, imobiliariaId),
    p_valor: valor,
    p_descricao: `Imobenviomassa · ${s}`,
  });
  if (error) {
    if (/vault_indisponivel/.test(error.message)) {
      throw new Error(
        "O Vault do Supabase não está ativo. Ative a extensão supabase_vault em Database › Extensions.",
      );
    }
    throw erroGenerico("segredos.gravar", error, "Não foi possível guardar a credencial.");
  }
}

export async function lerSegredo(s: Segredo, imobiliariaId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("wa_segredo_ler", {
    p_nome: nomeSegredo(s, imobiliariaId),
  });
  if (error) throw erroGenerico("segredos.ler", error, "Não foi possível ler a credencial.");
  return (data as string | null) || null;
}

export async function existeSegredo(s: Segredo, imobiliariaId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("wa_segredo_existe", {
    p_nome: nomeSegredo(s, imobiliariaId),
  });
  if (error) return false;
  return data === true;
}
