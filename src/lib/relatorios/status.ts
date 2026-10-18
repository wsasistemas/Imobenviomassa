import type { Database } from "@/integrations/supabase/types";

export type DestinatarioStatus = Database["imobenviomassa"]["Enums"]["wa_destinatario_status"];

type DestinatarioStatusFields = {
  status: DestinatarioStatus;
  assinado_em?: string | null;
  atualizado_em?: string | null;
  updated_at?: string | null;
};

type EnvelopeStatusFields = {
  status?: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
  declined_at?: string | null;
  voided_at?: string | null;
  last_event_at?: string | null;
} | null | undefined;

export const DEST_STATUS_LABEL: Record<DestinatarioStatus, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  entregue: "Entregue",
  assinado: "Assinado",
  erro: "Erro",
  opt_out: "Opt-out",
};

export const DEST_STATUS_VARIANT: Record<
  DestinatarioStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pendente: "outline",
  enviado: "secondary",
  entregue: "secondary",
  assinado: "default",
  erro: "destructive",
  opt_out: "outline",
};

export function getStatusAssinatura(destinatario: DestinatarioStatusFields, envelope?: EnvelopeStatusFields) {
  let status = destinatario.status;
  let assinadoEm = destinatario.assinado_em ?? null;
  const envStatus = envelope?.status?.trim().toLowerCase();

  if (envStatus) {
    if (["completed", "signed"].includes(envStatus)) {
      status = "assinado";
      assinadoEm = assinadoEm ?? envelope?.completed_at ?? envelope?.last_event_at ?? null;
    } else if (["declined", "voided"].includes(envStatus)) {
      status = "erro";
    } else if (envStatus === "delivered") {
      if (status !== "assinado") status = "entregue";
    } else if (envStatus === "sent") {
      if (status === "pendente") status = "enviado";
    }
  }

  return {
    status,
    assinado_em: assinadoEm,
    entregue_em: envelope?.sent_at ?? null,
    cancelado_em: envelope?.declined_at ?? envelope?.voided_at ?? null,
    docusign_status: envelope?.status ?? null,
    last_event_at: envelope?.last_event_at ?? destinatario.updated_at ?? destinatario.atualizado_em ?? null,
  };
}

export type StatusAssinaturaSimples = "assinado" | "pendente" | "cancelado";

export const STATUS_SIMPLES_LABEL: Record<StatusAssinaturaSimples, string> = {
  assinado: "Assinado",
  pendente: "Pendente assinatura",
  cancelado: "Cancelado",
};

export const STATUS_SIMPLES_VARIANT: Record<
  StatusAssinaturaSimples,
  "default" | "secondary" | "outline" | "destructive"
> = {
  assinado: "default",
  pendente: "secondary",
  cancelado: "destructive",
};

export function getStatusAssinaturaSimples(
  destinatario: DestinatarioStatusFields,
  envelope?: EnvelopeStatusFields,
): StatusAssinaturaSimples {
  const { status } = getStatusAssinatura(destinatario, envelope);
  if (status === "assinado") return "assinado";
  if (status === "erro" || status === "opt_out") return "cancelado";
  return "pendente";
}