// Tela "Permissões por aplicativo" — a mesma do Gestão Comercial, do Financeiro, do Gestão de
// Contratos e do Portal DP. Tudo passa pelas RPCs públicas do Supabase compartilhado (public.pa_*),
// que gravam no schema "acessos": o que o Super admin da Central muda aqui aparece igual em todos os
// aplicativos da Calper. O servidor (as próprias RPCs) confere o Super admin.
import { supabase } from "@/integrations/supabase/client";

export interface PerfilApp {
  value: string;
  label: string;
}

export interface AppAcesso {
  schema: string;
  name: string;
  url: string | null;
  dataSchema?: string;
  manual?: boolean;
  controlActive: boolean;
  newLoginsDefault: "bloqueado" | "liberado";
  configured: boolean;
  defaultProfile?: string | null;
  releaseProfile?: string | null;
  profiles?: PerfilApp[];
  protected?: boolean;
  lastCheckAt: string | null;
  totalLogins: number;
  allowedCount: number;
}

export interface LoginAcesso {
  id: string;
  name: string;
  email: string;
  lastSignInAt: string | null;
  registered: boolean;
  registeredByCentral?: boolean;
  owner: boolean;
  suffix?: boolean;
  canEnter: boolean;
}

export interface ResultadoLiberacao {
  changed: number;
  created: number;
  reactivated: number;
  skippedSuffix: number;
  profile: string | null;
}

/** Mensagem legível dos erros das RPCs (a regra de negócio devolve a frase pronta em `message`). */
export function mensagemErroAcesso(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message;
  return msg && !msg.startsWith("{") ? msg : "Não foi possível concluir a ação. Tente de novo.";
}

// As RPCs da Central não estão no types.ts gerado deste projeto.
const chamar = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

async function rpc<T>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await chamar(nome, args);
  if (error) throw error;
  return data as T;
}

/**
 * Schemas que a API expõe de fato: um schema inexistente no Accept-Profile devolve PGRST106 com
 * "Only the following schemas are exposed: …". `null` se a API não responder assim.
 */
async function schemasExpostos(): Promise<string[] | null> {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const r = await fetch(`${url}/rest/v1/pa_consulta_schemas_expostos`, {
      headers: { apikey: chave, "Accept-Profile": "pa_consulta_schemas_expostos" },
    });
    const corpo = (await r.json()) as { code?: string; hint?: string | null };
    const m = corpo.code === "PGRST106" ? /exposed:\s*(.+)$/i.exec(corpo.hint ?? "") : null;
    if (!m) return null;
    const lista = m[1].split(",").map((s) => s.trim()).filter(Boolean);
    return lista.length ? lista : null;
  } catch {
    return null;
  }
}

export const permissoesApp = {
  async listarAplicativos(): Promise<AppAcesso[]> {
    return rpc<AppAcesso[]>("pa_listar_aplicativos_expostos", { p_expostos: (await schemasExpostos()) ?? [] });
  },
  listarLogins(schema: string): Promise<LoginAcesso[]> {
    return rpc<LoginAcesso[]>("pa_listar_usuarios", { p_schema: schema });
  },
  definirPermissao(schema: string, ids: string[], pode: boolean): Promise<ResultadoLiberacao> {
    return rpc<ResultadoLiberacao>("pa_definir_permissao_v2", { p_schema: schema, p_usuarios: ids, p_pode: pode });
  },
  definirControle(schema: string, ativo: boolean): Promise<void> {
    return rpc<void>("pa_definir_controle", { p_schema: schema, p_ativo: ativo });
  },
  salvarAplicativo(schema: string, nome: string, url: string, padraoNovos: string, perfilLiberar: string): Promise<void> {
    return rpc<void>("pa_salvar_aplicativo_v2", {
      p_schema: schema,
      p_nome: nome,
      p_url: url,
      p_padrao_novos: padraoNovos,
      p_perfil_liberar: perfilLiberar,
    });
  },
  adicionarAplicativo(chave: string, nome: string, url: string, schemaDados: string): Promise<void> {
    return rpc<void>("pa_adicionar_aplicativo", { p_chave: chave, p_nome: nome, p_url: url, p_schema_dados: schemaDados });
  },
};

/** A verificação conta como instalada se o site do aplicativo consultou nos últimos 30 dias. */
export function verificacaoInstalada(app: AppAcesso): boolean {
  return app.lastCheckAt !== null && Date.now() - new Date(app.lastCheckAt).getTime() < 30 * 24 * 60 * 60 * 1000;
}
