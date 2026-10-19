import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPapel, imobiliariaDoContexto, type ContextoAutenticado } from "@/lib/authz";

// Gateway de APIs — escrita em api_registry só pelo SERVIDOR (auditoria de segurança 2026-10-01,
// item A11). Uma API cadastrada apontando para outro host receberia as credenciais do RM, por isso
// só o Super Admin cadastra/remove, o payload é validado aqui (zod) e a operação é auditada.
// A leitura (getApisRegistradas em src/lib/gateway.ts) continua pela RLS, admin-only.

const textoOpc = (max: number) => z.string().trim().max(max).nullable().optional();

const registrarSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome da API.")
    .max(120, "Nome com no máximo 120 caracteres.")
    .regex(/^[\w .\-/]+$/, "Nome só pode ter letras, números, espaço, ponto, hífen e barra."),
  base_url: z
    .string()
    .trim()
    .max(500, "URL base com no máximo 500 caracteres.")
    .refine((v) => !v || /^https:\/\//i.test(v), "A URL base precisa começar com https://")
    .nullable()
    .optional(),
  endpoint: z
    .string()
    .trim()
    .min(1, "Informe o endpoint.")
    .max(300, "Endpoint com no máximo 300 caracteres."),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  description: textoOpc(500),
  source: z.enum(["rest", "soap", "webhook", "endpoint"]).nullable().optional(),
  auth_type: z.enum(["none", "basic", "bearer", "header"]).nullable().optional(),
  auth_secret_ref: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Z0-9_]*$/, "Secret de auth: só letras maiúsculas, números e _.")
    .nullable()
    .optional(),
  soap_service: z.enum(["consultaSQL", "dataServer", "process"]).nullable().optional(),
  soap_action: textoOpc(200),
  soap_envelope_template: textoOpc(20000),
  soap_response_path: textoOpc(300),
});

export type RegistrarApiGatewayInput = z.input<typeof registrarSchema>;

async function exigirSuperAdmin(context: unknown) {
  await exigirPapel(
    context as ContextoAutenticado,
    ["super_admin"],
    "Só um Super Admin cadastra APIs no gateway.",
  );
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

// Detalhe do PostgREST só no log do servidor (auditoria, Fase 3 / N10). Import dinâmico:
// *.functions.ts também vai para o bundle do navegador.
async function erroGenerico(origem: string, erro: unknown, mensagem: string): Promise<Error> {
  return (await import("@/lib/erros.server")).erroGenerico(origem, erro, mensagem);
}

/** Converte "" em null para os campos opcionais (o formulário manda string vazia). */
function vazioParaNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v;
  return out as T;
}

export const registrarApiGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const bruto =
      typeof input === "object" && input ? vazioParaNull(input as Record<string, unknown>) : input;
    const r = registrarSchema.safeParse(bruto);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados da API inválidos.");
    return r.data;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await exigirSuperAdmin(context);
    const ctx = context as ContextoAutenticado;
    const imob = await imobiliariaDoContexto(ctx);
    const sb = await admin();
    const { auditar } = await import("@/lib/auditoria.server");

    const { data: criado, error } = await sb
      .from("api_registry")
      .insert({
        imobiliaria_id: imob,
        name: data.name,
        base_url: data.base_url ?? null,
        endpoint: data.endpoint,
        method: data.method,
        description: data.description ?? null,
        source: data.source ?? "rest",
        auth_type: data.auth_type ?? "none",
        auth_secret_ref: data.auth_secret_ref ?? null,
        soap_service: data.soap_service ?? null,
        soap_action: data.soap_action ?? null,
        soap_envelope_template: data.soap_envelope_template ?? null,
        soap_response_path: data.soap_response_path ?? null,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !criado)
      throw await erroGenerico(
        "gateway.registrar",
        error ?? "sem retorno",
        "Não foi possível registrar a API.",
      );

    await auditar({
      userId: ctx.userId,
      acao: "api_registrada",
      entidade: "api_registry",
      entidadeId: criado.id,
      detalhes: {
        name: data.name,
        method: data.method,
        endpoint: data.endpoint,
        base_url: data.base_url ?? null,
        source: data.source ?? "rest",
        auth_type: data.auth_type ?? "none",
      },
    });
    return { id: criado.id };
  });

export const removerApiGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid("API inválida.") }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await exigirSuperAdmin(context);
    const ctx = context as ContextoAutenticado;
    const imob = await imobiliariaDoContexto(ctx);
    const sb = await admin();
    const { auditar } = await import("@/lib/auditoria.server");

    const { data: existente } = await sb
      .from("api_registry")
      .select("name, endpoint")
      .eq("id", data.id)
      .eq("imobiliaria_id", imob)
      .maybeSingle();
    if (!existente) throw new Error("API não encontrada.");

    const { error } = await sb
      .from("api_registry")
      .delete()
      .eq("id", data.id)
      .eq("imobiliaria_id", imob);
    if (error)
      throw await erroGenerico("gateway.remover", error, "Não foi possível remover a API.");

    await auditar({
      userId: ctx.userId,
      acao: "api_removida",
      entidade: "api_registry",
      entidadeId: data.id,
      detalhes: { name: existente.name, endpoint: existente.endpoint },
    });
    return { ok: true };
  });
