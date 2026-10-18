// Gera src/integrations/supabase/types.ts do schema imobenviomassa sem precisar do banco real: aplica as migrations de
// supabase/imobsystem/migrations num Postgres local (PGlite) com o mínimo do Supabase simulado (auth, Central de
// acessos) e lê o catálogo. Formato igual ao `supabase gen types`. Rode `npm run tipos` depois de cada migration nova.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const SCHEMA = "imobenviomassa";
const raiz = new URL("../", import.meta.url);
const dirMig = new URL("supabase/imobsystem/migrations/", raiz);

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create role authenticator noinherit login;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create schema acessos;
  create table acessos.aplicativos (schema_name text primary key, nome text not null, url text, perfil_liberar text);
  create function acessos.eu_posso(p_app text) returns boolean language sql stable as $$ select true $$;
`);
for (const f of readdirSync(dirMig).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(new URL(f, dirMig), "utf8"));
}

const q = async (sql) => (await db.query(sql)).rows;

const enums = await q(`
  select t.typname as nome, array_agg(e.enumlabel order by e.enumsortorder) as valores
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = '${SCHEMA}' group by t.typname order by t.typname`);
const nomesEnum = new Set(enums.map((e) => e.nome));

function tsTipo(udt, arr = false) {
  if (udt.startsWith("_")) return `${tsTipo(udt.slice(1))}[]`;
  if (nomesEnum.has(udt)) return `Database["${SCHEMA}"]["Enums"]["${udt}"]`;
  if (["uuid", "text", "varchar", "bpchar", "citext", "timestamptz", "timestamp", "date", "time", "interval", "inet"].includes(udt)) return "string";
  if (["int2", "int4", "int8", "numeric", "float4", "float8"].includes(udt)) return "number";
  if (udt === "bool") return "boolean";
  if (udt === "json" || udt === "jsonb") return "Json";
  if (udt === "void") return "undefined";
  return "unknown";
}

const colunas = await q(`
  select c.table_name, c.column_name, c.udt_name, c.is_nullable = 'YES' as nulo,
         (c.column_default is not null or c.is_identity = 'YES') as tem_default
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = '${SCHEMA}' and t.table_type = 'BASE TABLE'
   order by c.table_name, c.column_name`);

const fks = await q(`
  select con.conname, cl.relname as tabela, rcl.relname as ref,
         array(select a.attname from unnest(con.conkey) with ordinality k(n, i)
                 join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.i) as cols,
         array(select a.attname from unnest(con.confkey) with ordinality k(n, i)
                 join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.i) as refcols,
         exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p','u')
                  and u.conkey::int[] @> con.conkey::int[] and u.conkey::int[] <@ con.conkey::int[]) as um_para_um,
         rn.nspname as ref_schema
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
    join pg_class rcl on rcl.oid = con.confrelid join pg_namespace rn on rn.oid = rcl.relnamespace
   where con.contype = 'f' and n.nspname = '${SCHEMA}' and rn.nspname = '${SCHEMA}'
   order by con.conname`);

const funcoes = await q(`
  select p.proname as nome, pg_get_function_arguments(p.oid) as args_txt,
         coalesce(p.proargnames, '{}') as argnomes, coalesce(p.proargmodes::text[], '{}') as argmodos,
         array(select tt.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(t, i)
                 join pg_type tt on tt.oid = u.t order by u.i) as argudts,
         p.pronargdefaults as n_defaults, p.pronargs as n_args, rt.typname as ret, p.proretset as setof
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
   where n.nspname = '${SCHEMA}' and rt.typname <> 'trigger'
   order by p.proname`);

const ind = (n) => "  ".repeat(n);
let out = `// Gerado por scripts/gerar-tipos-banco.mjs (npm run tipos) a partir de supabase/imobsystem/migrations. Não edite à mão.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  ${SCHEMA}: {
    Tables: {
`;
const tabelas = [...new Set(colunas.map((c) => c.table_name))];
for (const t of tabelas) {
  const cs = colunas.filter((c) => c.table_name === t);
  out += `${ind(3)}${t}: {\n${ind(4)}Row: {\n`;
  for (const c of cs) out += `${ind(5)}${c.column_name}: ${tsTipo(c.udt_name)}${c.nulo ? " | null" : ""}\n`;
  out += `${ind(4)}}\n${ind(4)}Insert: {\n`;
  for (const c of cs) out += `${ind(5)}${c.column_name}${c.nulo || c.tem_default ? "?" : ""}: ${tsTipo(c.udt_name)}${c.nulo ? " | null" : ""}\n`;
  out += `${ind(4)}}\n${ind(4)}Update: {\n`;
  for (const c of cs) out += `${ind(5)}${c.column_name}?: ${tsTipo(c.udt_name)}${c.nulo ? " | null" : ""}\n`;
  out += `${ind(4)}}\n${ind(4)}Relationships: [\n`;
  for (const f of fks.filter((f) => f.tabela === t)) {
    out += `${ind(5)}{\n${ind(6)}foreignKeyName: "${f.conname}"\n${ind(6)}columns: [${f.cols.map((c) => `"${c}"`).join(", ")}]\n`;
    out += `${ind(6)}isOneToOne: ${f.um_para_um}\n${ind(6)}referencedRelation: "${f.ref}"\n`;
    out += `${ind(6)}referencedColumns: [${f.refcols.map((c) => `"${c}"`).join(", ")}]\n${ind(5)}},\n`;
  }
  out += `${ind(4)}]\n${ind(3)}}\n`;
}
out += `${ind(2)}}\n${ind(2)}Views: {\n${ind(3)}[_ in never]: never\n${ind(2)}}\n${ind(2)}Functions: {\n`;

for (const f of funcoes) {
  const modos = f.argmodos.length ? f.argmodos : f.argudts.map(() => "i");
  const entradas = [];
  const saidas = [];
  f.argudts.forEach((udt, i) => {
    const item = { nome: f.argnomes[i] || `arg${i}`, tipo: tsTipo(udt) };
    if (modos[i] === "i" || modos[i] === "b") entradas.push(item);
    if (modos[i] === "t" || modos[i] === "o" || modos[i] === "b") saidas.push(item);
  });
  const opcionalDesde = entradas.length - f.n_defaults;
  out += `${ind(3)}${f.nome}: {\n${ind(4)}Args: `;
  out += entradas.length
    ? `{\n${entradas.map((a, i) => `${ind(5)}${a.nome}${i >= opcionalDesde ? "?" : ""}: ${a.tipo}${i >= opcionalDesde ? " | null" : ""}`).join("\n")}\n${ind(4)}}\n`
    : `never\n`;
  let ret;
  if (saidas.length) ret = `{\n${saidas.map((s) => `${ind(5)}${s.nome}: ${s.tipo}`).join("\n")}\n${ind(4)}}[]`;
  else ret = tsTipo(f.ret) + (f.setof ? "[]" : "");
  out += `${ind(4)}Returns: ${ret}\n${ind(3)}}\n`;
}
out += `${ind(2)}}\n${ind(2)}Enums: {\n`;
for (const e of enums) out += `${ind(3)}${e.nome}: ${e.valores.map((v) => `"${v}"`).join(" | ")}\n`;
out += `${ind(2)}}\n${ind(2)}CompositeTypes: {\n${ind(3)}[_ in never]: never\n${ind(2)}}\n${ind(1)}}\n`;

// Central de acessos do ikvj (schema public): só as funções que o app chama.
out += `  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pode_acessar_app: { Args: { p_app: string }; Returns: boolean }
      pa_sou_super_admin: { Args: never; Returns: boolean }
      pa_listar_aplicativos: {
        Args: never
        Returns: {
          schema_name: string
          nome: string
          url: string | null
          controle_ativo: boolean
          padrao_novos: string
          schema_dados: string
          ultima_verificacao_em: string | null
          controle_ativado_em: string | null
          liberados: number
          bloqueados: number
        }[]
      }
      pa_listar_usuarios: {
        Args: { p_app: string; p_busca?: string }
        Returns: {
          user_id: string
          email: string
          criado_em: string
          ultimo_login: string | null
          proprietario: boolean
          tem_cadastro: boolean
          decisao: boolean | null
          efetivo: boolean
        }[]
      }
      pa_definir_controle: { Args: { p_app: string; p_ativo: boolean }; Returns: undefined }
      pa_definir_permissao: { Args: { p_app: string; p_usuario: string; p_pode: boolean | null }; Returns: boolean }
      pa_salvar_aplicativo: {
        Args: { p_app: string; p_nome: string; p_url: string; p_padrao_novos: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals["${SCHEMA}"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export const Constants = {
  ${SCHEMA}: {
    Enums: {
${enums.map((e) => `      ${e.nome}: [${e.valores.map((v) => `"${v}"`).join(", ")}],`).join("\n")}
    },
  },
} as const
`;
writeFileSync(new URL("src/integrations/supabase/types.ts", raiz), out);
console.log(`types.ts: ${tabelas.length} tabelas, ${funcoes.length} funções, ${enums.length} enums.`);
