import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { limparRascunhoWizard } from "@/stores/wizard-store";
import { clearEmpreendimentosCache } from "@/services/totvs-cache";

const PREFIXOS_LOCAIS = ["wa:", "wa-"];

function limparStorage(storage: Storage | undefined) {
  if (!storage) return;
  const remover: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && PREFIXOS_LOCAIS.some((p) => k.startsWith(p))) remover.push(k);
  }
  for (const k of remover) storage.removeItem(k);
}

/**
 * Logout centralizado do portal: apaga tudo que este portal guardou no navegador
 * (rascunho do wizard com CPF/telefone, cache TOTVS, React Query) e encerra a
 * sessão Supabase SOMENTE neste navegador (`scope: "local"`).
 *
 * IMPORTANTE: a conta Auth é compartilhada com outros portais Calper. Um
 * `signOut()` global revogaria as sessões dos outros sistemas também.
 */
export async function sairDoPortal(opts?: { queryClient?: QueryClient; redirecionar?: boolean }) {
  if (opts?.queryClient) {
    try {
      await opts.queryClient.cancelQueries();
      opts.queryClient.clear();
    } catch {
      /* ignora */
    }
  }

  try {
    limparRascunhoWizard();
  } catch {
    /* storage indisponível */
  }
  try {
    clearEmpreendimentosCache();
  } catch {
    /* storage indisponível */
  }
  if (typeof window !== "undefined") {
    try {
      limparStorage(window.sessionStorage);
      limparStorage(window.localStorage);
    } catch {
      /* storage indisponível (modo privado, etc.) */
    }
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* sessão já inválida — segue para a tela de login mesmo assim */
  }

  if (opts?.redirecionar !== false && typeof window !== "undefined") {
    window.location.assign("/auth");
  }
}
