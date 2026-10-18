// Cache client-side (localStorage) de dados da TOTVS.
// Padrão inspirado no projeto "superapp": TTL curto, fallback offline
// e auto-sync em segundo plano feito pelo consumidor (React Query).

import type { EmpreendimentoTotvs } from "@/lib/integracoes/totvs.functions";

const TTL_MS = 5 * 60_000; // 5 minutos
const KEY_EMP = "wa:totvs:empreendimentos";

export type EmpreendimentosCache = {
  empreendimentos: EmpreendimentoTotvs[];
  fetchedAt: string;
  count?: number;
  fromCache?: boolean;
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readEmpreendimentosCache(): EmpreendimentosCache | null {
  const ls = safeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY_EMP);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmpreendimentosCache;
    if (!parsed?.fetchedAt) return null;
    return { ...parsed, fromCache: true };
  } catch {
    return null;
  }
}

export function isEmpreendimentosCacheFresh(cache: EmpreendimentosCache | null): boolean {
  if (!cache?.fetchedAt) return false;
  return Date.now() - new Date(cache.fetchedAt).getTime() < TTL_MS;
}

export function writeEmpreendimentosCache(cache: EmpreendimentosCache): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(
      KEY_EMP,
      JSON.stringify({
        empreendimentos: cache.empreendimentos,
        fetchedAt: cache.fetchedAt,
        count: cache.count,
      }),
    );
  } catch {
    /* quota / privacy mode */
  }
}

export function clearEmpreendimentosCache(): void {
  safeLocalStorage()?.removeItem(KEY_EMP);
}

export const TOTVS_CACHE_TTL_MS = TTL_MS;
