// Webhook da Zenvia (assinaturas MESSAGE e MESSAGE_STATUS) da Régua de Cobrança — decisão D1: única peça em
// Edge Function, porque a Zenvia precisa de um endereço público fixo e chama sem login.
//
// Chamado pela Zenvia, sem JWT (verify_jwt = false). Autenticação: ?imob=<uuid da imobiliária> + cabeçalho
// x-imobenviomassa-chave, comparado (sem atalho) com o segredo zenvia_webhook_<imob> do Vault.
// Grava o evento cru em zenvia_eventos (idempotente) e, em MESSAGE_STATUS, atualiza a tentativa da régua
// (entregue / lido / falha). O status "entregue" só existe quando a Zenvia devolve este webhook (PRD 7).
// Lógica de leitura do evento adaptada do Vs_Portal_Atendimento (_shared/atendimento/zenvia.ts → lerEvento).

import { createClient } from "npm:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resposta = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

function iguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Zenvia → status da tentativa da régua
const STATUS: Record<string, "enviado" | "entregue" | "lido" | "falha"> = {
  SENT: "enviado",
  DELIVERED: "entregue",
  READ: "lido",
  REJECTED: "falha",
  NOT_DELIVERED: "falha",
  NOT_SENT: "falha",
};
// Ordem para não regredir (um SENT atrasado não desfaz um DELIVERED).
const ORDEM: Record<string, number> = { processando: 0, pendente: 0, enviado: 1, entregue: 2, lido: 3, falha: 4 };

Deno.serve(async (req) => {
  if (req.method !== "POST") return resposta(405, { erro: "Método não suportado." });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return resposta(500, { erro: "Função sem configuração do Supabase." });

  const imob = new URL(req.url).searchParams.get("imob") ?? "";
  if (!UUID_RE.test(imob)) return resposta(400, { erro: "Imobiliária inválida." });

  const db = createClient(url, key, { db: { schema: "imobenviomassa" }, auth: { persistSession: false, autoRefreshToken: false } });
  const segredo = await db.rpc("wa_segredo_ler", { p_nome: `zenvia_webhook_${imob.replace(/-/g, "")}` });
  const chave = (segredo.data as string | null) ?? "";
  if (!iguais(req.headers.get("x-imobenviomassa-chave") ?? "", chave)) return resposta(401, { erro: "Chave inválida." });

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return resposta(400, { erro: "Corpo inválido." });

  const tipo = String(payload.type ?? "?");
  const ms = (payload.messageStatus ?? {}) as { code?: string; description?: string; causes?: { reason?: string; details?: string }[] };
  const msg = (payload.message ?? {}) as Record<string, unknown>;
  const zenviaId = tipo === "MESSAGE_STATUS" ? String(payload.messageId ?? "") : String(msg.id ?? payload.id ?? "");
  const codigo = tipo === "MESSAGE_STATUS" ? String(ms.code ?? "").toUpperCase() : null;

  const ins = await db.from("zenvia_eventos").insert({
    imobiliaria_id: imob,
    tipo,
    zenvia_id: zenviaId || null,
    status: codigo,
    payload,
  });
  // 23505 = a Zenvia reenviou o mesmo evento: já foi gravado e processado.
  if (ins.error && ins.error.code !== "23505") {
    console.error(JSON.stringify({ evento: "regua.webhook_falhou", erro: ins.error.message }));
    return resposta(500, { erro: "Falha ao gravar o evento." });
  }
  if (ins.error) return resposta(200, { ok: true, repetido: true });

  if (tipo === "MESSAGE_STATUS" && zenviaId && codigo && STATUS[codigo]) {
    const novo = STATUS[codigo];
    const { data: t } = await db
      .from("regua_tentativa")
      .select("id, boleto_id, status")
      .eq("imobiliaria_id", imob)
      .eq("provedor", "zenvia")
      .eq("id_provedor", zenviaId)
      .maybeSingle();
    if (t && (ORDEM[novo] ?? 0) > (ORDEM[t.status] ?? 0)) {
      const causa = ms.causes?.map((c) => [c.reason, c.details].filter(Boolean).join(": ")).join("; ");
      await db
        .from("regua_tentativa")
        .update({
          status: novo,
          erro: novo === "falha" ? (causa || ms.description || "Recusada pela Zenvia").slice(0, 300) : null,
          entregue_em: novo === "entregue" || novo === "lido" ? new Date().toISOString() : undefined,
        })
        .eq("id", t.id);
      await db.rpc("regua_recalcular_boleto", { p_boleto: t.boleto_id });
    }
  }
  // Mensagens recebidas (resposta do cliente) ficam só registradas: atendimento pelo WhatsApp é fase 2 do PRD.
  return resposta(200, { ok: true });
});
