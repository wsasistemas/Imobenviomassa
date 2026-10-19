import type { ReactNode } from "react";
import {
  AlertTriangle,
  CircleCheckBig,
  FileText,
  History,
  Info,
  Lock,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Selo } from "@/components/page";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";
import {
  ROTULO_BOLETO,
  ROTULO_CONTATO,
  ROTULO_REGISTRO,
  ROTULO_REGUA,
  ROTULO_STATUS_LOTE,
  ROTULO_TENTATIVA,
  type ReguaLote,
  type StatusBoleto,
  type StatusContato,
  type StatusLote,
  type StatusRegistro,
  type StatusTentativa,
} from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

type Tom = "info" | "warning" | "success" | "danger" | undefined;

const TOM_LOTE: Record<StatusLote, Tom> = {
  rascunho: undefined,
  em_processamento: "info",
  concluido: "success",
  concluido_com_falhas: "warning",
  cancelado: undefined,
};
const TOM_TENTATIVA: Record<StatusTentativa, Tom> = {
  pendente: undefined,
  processando: "info",
  enviado: "info",
  entregue: "success",
  lido: "success",
  falha: "danger",
  bloqueado_24h: "warning",
  cancelado: undefined,
};
const TOM_BOLETO: Record<StatusBoleto, Tom> = {
  pendente: undefined,
  elegivel: "success",
  excecao_registro: "danger",
  excecao_contato: "warning",
  excluido: undefined,
  processando: "info",
  sucesso: "success",
  parcial: "warning",
  falha: "danger",
};
const TOM_CONTATO: Record<StatusContato, Tom> = {
  valido: "success",
  invalido: "danger",
  nao_localizado: "warning",
  erro: "danger",
  nao_informado: undefined,
};
const TOM_REGISTRO: Record<StatusRegistro, Tom> = {
  registrado: "success",
  nao_registrado: "danger",
  nao_verificado: "warning",
  erro: "danger",
};
const TOM_REGUA: Record<ReguaLote, Tom> = {
  a_vencer: undefined,
  "30": "info",
  "60": "warning",
  "90": "danger",
  "90+": "danger",
  personalizada: "info",
};

export const SeloLote = ({ s }: { s: StatusLote }) => (
  <Selo tom={TOM_LOTE[s]}>{ROTULO_STATUS_LOTE[s]}</Selo>
);
export const SeloTentativa = ({ s }: { s: StatusTentativa | null | undefined }) =>
  s ? (
    <Selo tom={TOM_TENTATIVA[s]}>{ROTULO_TENTATIVA[s]}</Selo>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
export const SeloBoleto = ({ s }: { s: StatusBoleto }) => (
  <Selo tom={TOM_BOLETO[s]}>{ROTULO_BOLETO[s]}</Selo>
);
export const SeloContato = ({ s }: { s: StatusContato | null | undefined }) =>
  s ? (
    <Selo tom={TOM_CONTATO[s]}>{ROTULO_CONTATO[s]}</Selo>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
export const SeloRegistro = ({ s }: { s: StatusRegistro }) => (
  <Selo tom={TOM_REGISTRO[s]}>{ROTULO_REGISTRO[s]}</Selo>
);
export const SeloRegua = ({ r }: { r: ReguaLote | null | undefined }) =>
  r ? (
    <Selo tom={TOM_REGUA[r]}>{ROTULO_REGUA[r]}</Selo>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

export function Kpi({
  icone,
  valor,
  rotulo,
  extra,
}: {
  icone: LucideIcon;
  valor: ReactNode;
  rotulo: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid h-11 w-11 place-items-center rounded-[13px] bg-secondary">
        <IconeIlustrativo icon={icone} size={26} />
      </div>
      <div>
        <div className="text-[22px] font-extrabold leading-none tracking-[-0.02em]">{valor}</div>
        <div className="mt-1 text-[12px] font-medium text-muted-foreground">{rotulo}</div>
        {extra && <div className="mt-0.5 text-[11px] font-bold text-success">{extra}</div>}
      </div>
    </div>
  );
}

export function Contador({
  valor,
  rotulo,
  tom,
}: {
  valor: number | string;
  rotulo: string;
  tom?: "success" | "danger" | "warning";
}) {
  return (
    <div className="rounded-[11px] border bg-card px-3.5 py-3">
      <b
        className={cn(
          "block text-[22px] font-extrabold leading-tight",
          tom === "success" && "text-success",
          tom === "danger" && "text-primary-dark",
          tom === "warning" && "text-warning",
        )}
      >
        {valor}
      </b>
      <span className="text-[11.5px] font-semibold text-muted-foreground">{rotulo}</span>
    </div>
  );
}

/** Destaca o que veio de variável (marca amarela, como no mockup). */
function Destaque({ texto, valores }: { texto: string; valores: string[] }) {
  const alvo = valores.filter((v) => v && v.length > 1).sort((a, b) => b.length - a.length);
  if (!alvo.length) return <>{texto}</>;
  const re = new RegExp(
    `(${alvo.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );
  return (
    <>
      {texto.split(re).map((p, i) =>
        alvo.includes(p) ? (
          <mark key={i} className="rounded-[3px] bg-[oklch(0.95_0.06_90)] px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function PreviaWhatsapp({
  texto,
  documento,
  destaques = [],
}: {
  texto: string;
  documento: string | null;
  destaques?: string[];
}) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[26px] border-[8px] border-[#1f1d1c] bg-[#e9e1d8] px-2.5 py-3.5">
      <div className="rounded-[10px] bg-white px-2.5 pb-1.5 pt-2 text-[12.5px] leading-[1.45] text-[#222] shadow-sm">
        {documento && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#f2ede8] p-2">
            <IconeIlustrativo icon={FileText} size={26} />
            <div className="min-w-0">
              <b className="block truncate text-[12px]">{documento}</b>
              <small className="text-[10.5px] text-[#8a7f76]">PDF · protegido por senha</small>
            </div>
          </div>
        )}
        <p className="whitespace-pre-wrap">
          <Destaque texto={texto} valores={destaques} />
        </p>
        <div className="mt-0.5 text-right text-[10px] text-[#8a7f76]">agora ✓✓</div>
      </div>
    </div>
  );
}

export function PreviaEmail({
  de,
  para,
  assunto,
  texto,
  anexo,
}: {
  de: string;
  para: string;
  assunto: string;
  texto: string;
  anexo: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="bg-secondary px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        De: <b className="text-foreground">{de}</b>
        <br />
        Para: {para}
        <br />
        Assunto: <b className="text-foreground">{assunto}</b>
      </div>
      <div className="whitespace-pre-wrap p-4 text-[13px] leading-relaxed">
        {texto}
        {anexo && (
          <div className="mt-3 flex w-fit items-center gap-2 rounded-[9px] border px-2.5 py-1.5 text-[12px]">
            <FileText className="h-4 w-4 text-info" /> {anexo}{" "}
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

export function Aviso({
  tom = "info",
  children,
  icone,
}: {
  tom?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
  icone?: LucideIcon;
}) {
  const bg = {
    info: "bg-info-soft",
    warning: "bg-warning-soft",
    danger: "bg-primary-soft",
    success: "bg-success-soft",
  }[tom];
  const ic =
    icone ?? { info: Info, warning: AlertTriangle, danger: XCircle, success: CircleCheckBig }[tom];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px]", bg)}>
      <span className="mt-0.5 shrink-0">
        <IconeIlustrativo icon={ic} size={18} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Vazio({
  icone = History,
  titulo,
  children,
}: {
  icone?: LucideIcon;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <IconeIlustrativo icon={icone} size={44} />
      <p className="text-[14px] font-semibold">{titulo}</p>
      {children && <p className="max-w-[440px] text-[12.5px] text-muted-foreground">{children}</p>}
    </div>
  );
}
