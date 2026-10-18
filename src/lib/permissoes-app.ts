// Tela "Permissões por aplicativo" — Central de acessos do Supabase ImobSystem (schema "acessos"), a mesma do
// ImobSystem, do Imobsuprimentos e do ImobDoces. Tudo passa pelas RPCs públicas public.pa_*: o que o super admin
// da Central muda aqui vale para todos os aplicativos do login compartilhado. As próprias RPCs conferem o
// super admin (conta proprietária).
//
// A tela foi desenhada para a Central da Calper (pa_*_v2, cadastro de app pela tela). Este adaptador mantém o
// formato que ela usa e traduz para as RPCs do ikvj: pa_listar_aplicativos, pa_listar_usuarios(p_app, p_busca),
// pa_definir_permissao(p_app, p_usuario, p_pode), pa_definir_controle, pa_salvar_aplicativo.
import { supabase } from "@/integrations/supabase/client";
import { APP_KEY } from "@/lib/app-key";

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

const central = () => supabase.schema("public");

function nomeDoEmail(email: string) {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const permissoesApp = {
  async listarAplicativos(): Promise<AppAcesso[]> {
    const { data, error } = await central().rpc("pa_listar_aplicativos");
    if (error) throw error;
    return (data ?? []).map((a) => {
      const proprio = a.schema_name === APP_KEY;
      return {
        schema: a.schema_name,
        name: a.nome,
        url: a.url,
        dataSchema: a.schema_dados,
        manual: a.schema_dados !== a.schema_name,
        controlActive: a.controle_ativo,
        newLoginsDefault: a.padrao_novos === "liberado" ? "liberado" : "bloqueado",
        configured: true,
        // Neste app, "Liberar" na Central cadastra como Analista (acessos.aplicativos.perfil_liberar).
        defaultProfile: proprio ? "Analista" : null,
        releaseProfile: null,
        profiles: undefined,
        // Neste app a Central também vale na RLS (tenant_atual → acessos.eu_posso).
        protected: proprio,
        lastCheckAt: a.ultima_verificacao_em,
        totalLogins: Number(a.liberados) + Number(a.bloqueados),
        allowedCount: Number(a.liberados),
      } satisfies AppAcesso;
    });
  },

  async listarLogins(schema: string): Promise<LoginAcesso[]> {
    const { data, error } = await central().rpc("pa_listar_usuarios", { p_app: schema });
    if (error) throw error;
    return (data ?? []).map((u) => ({
      id: u.user_id,
      name: nomeDoEmail(u.email),
      email: u.email,
      lastSignInAt: u.ultimo_login,
      registered: u.tem_cadastro,
      owner: u.proprietario,
      canEnter: u.efetivo,
    }));
  },

  async definirPermissao(schema: string, ids: string[], pode: boolean): Promise<ResultadoLiberacao> {
    let changed = 0;
    for (const id of ids) {
      const { error } = await central().rpc("pa_definir_permissao", { p_app: schema, p_usuario: id, p_pode: pode });
      if (error) throw error;
      changed++;
    }
    return { changed, created: 0, reactivated: 0, skippedSuffix: 0, profile: null };
  },

  async definirControle(schema: string, ativo: boolean): Promise<void> {
    const { error } = await central().rpc("pa_definir_controle", { p_app: schema, p_ativo: ativo });
    if (error) throw error;
  },

  // A Central do ikvj não guarda "perfil ao liberar" pela tela (o app define na própria migração).
  async salvarAplicativo(schema: string, nome: string, url: string, padraoNovos: string, _perfilLiberar: string): Promise<void> {
    const { error } = await central().rpc("pa_salvar_aplicativo", {
      p_app: schema,
      p_nome: nome,
      p_url: url,
      p_padrao_novos: padraoNovos,
    });
    if (error) throw error;
  },

  async adicionarAplicativo(_chave: string, _nome: string, _url: string, _schemaDados: string): Promise<void> {
    throw new Error("Na Central do ImobSystem, cada aplicativo se cadastra pela própria migração do banco.");
  },
};

/** A verificação conta como instalada se o site do aplicativo consultou nos últimos 30 dias. */
export function verificacaoInstalada(app: AppAcesso): boolean {
  return app.lastCheckAt !== null && Date.now() - new Date(app.lastCheckAt).getTime() < 30 * 24 * 60 * 60 * 1000;
}
