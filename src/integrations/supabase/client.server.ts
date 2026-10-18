// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { DB_SCHEMA } from './schema';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.APP_SUPABASE_URL ||
    process.env.SB_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.APP_SERVICE_ROLE_KEY ||
    process.env.SB_SERVICE_KEY ||
    process.env.GATEWAY_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    // Em produção só o log do servidor diz quais variáveis faltam; o erro que pode chegar ao
    // cliente é genérico (não expõe nomes de variáveis de ambiente). Em desenvolvimento o erro
    // já traz os nomes, para não ser preciso procurar no terminal.
    console.error(
      `[Supabase] Variáveis ausentes no servidor: ${missing.join(', ')}. Defina no .env (desenvolvimento) ou em Vercel → Settings → Environment Variables e faça um novo deploy.`,
    );
    throw new Error(
      process.env.NODE_ENV === 'production'
        ? 'Configuração do Supabase indisponível.'
        : `Configuração do Supabase indisponível (faltando no .env: ${missing.join(', ')}). Reinicie o servidor após editar o .env.`,
    );
  }

  // Chave publishable (a mesma do navegador) no lugar da secret: o cliente é criado, mas toda
  // operação de admin/RPC restrita ao service_role falha com "permission denied". Falha cedo.
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_')) {
    console.error(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY contém uma chave publishable (sb_publishable_...). Use a secret key (sb_secret_...) ou a service_role legada, em Project Settings → API Keys.',
    );
    throw new Error(
      process.env.NODE_ENV === 'production'
        ? 'Configuração do Supabase indisponível.'
        : 'Configuração do Supabase indisponível (SUPABASE_SERVICE_ROLE_KEY é uma chave publishable; use a secret key sb_secret_... ou a service_role).',
    );
  }

  return createClient<Database, typeof DB_SCHEMA>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: DB_SCHEMA },
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
