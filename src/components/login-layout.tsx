import { useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Eye, EyeOff, Lock, Send, ShieldCheck } from "lucide-react";
import calperLogo from "@/assets/calper-logo.png";

// Layout e campos da tela de entrada — padrão do Portal DP e do Gestão de Contratos.

const ANO = new Date().getFullYear();

const RECURSOS = [
  { icon: Send, texto: "Envio de documentos em massa via DocuSign" },
  { icon: BarChart3, texto: "Acompanhamento das assinaturas em tempo real" },
  { icon: ShieldCheck, texto: "Controle de acesso por perfil" },
];

/** Tela de entrada (login e troca de senha): painel grafite à esquerda, cartão à direita. */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* ===== Painel escuro (esquerda) ===== */}
      <aside className="flex flex-col bg-[#171717] px-4 py-6 text-white md:px-[clamp(20px,3vw,40px)] md:pb-4">
        {/* a logo oficial tem fundo branco: fica num cartão branco sobre o painel escuro */}
        <div className="inline-flex items-center self-start rounded-[10px] bg-white px-3.5 py-2">
          <img src={calperLogo} alt="Calper — gestão compartilhada" className="block h-auto w-[130px] md:w-[150px]" />
        </div>

        <div className="flex max-w-[440px] flex-1 flex-col justify-center pt-6 md:py-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a9ba3]">Calper</p>
          <h1 className="mb-2.5 text-[clamp(24px,2.4vw,30px)] font-bold tracking-[-0.02em]">Disparo em Massa</h1>
          <p className="text-sm leading-relaxed text-[#b4b5bb] md:border-b md:border-white/10 md:pb-5 md:text-[13.5px]">
            Plataforma corporativa para envio de documentos para assinatura via DocuSign, com gestão centralizada das
            campanhas.
          </p>
          <ul className="mt-5 hidden flex-col gap-2.5 text-[13px] text-[#e6e6e8] md:flex">
            {RECURSOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-white/10 text-[#d9d9dc]">
                  <Icon className="h-[15px] w-[15px]" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-[11.5px] text-[#7c7d84] md:block">© {ANO} Calper</p>
      </aside>

      {/* ===== Formulário (direita) ===== */}
      <main className="flex flex-col items-center justify-center gap-4 bg-[#f8f7f5] px-4 pb-8 pt-6 md:px-5 md:py-8">
        {children}
        <p className="text-center text-[11.5px] text-dimmer">© {ANO} Calper. Todos os direitos reservados.</p>
      </main>
    </div>
  );
}

export const inputCls =
  "h-full min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-dimmer";
export const submitCls =
  "inline-flex h-[38px] items-center justify-center gap-2 rounded-[3px] bg-[#b3262e] text-[13.5px] font-semibold text-white hover:bg-[#951f26] disabled:opacity-55";

export function LoginCard({
  titulo,
  sub,
  onSubmit,
  children,
}: {
  titulo: string;
  sub: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex w-full max-w-[340px] flex-col gap-3.5 rounded-[4px] border bg-white px-5 py-6 md:px-6 md:py-[26px]"
    >
      <div>
        <h2 className="mb-1 text-[17px] font-bold">{titulo}</h2>
        <p className="text-[13px] text-muted-foreground">{sub}</p>
      </div>
      {children}
    </form>
  );
}

export function Campo({ id, label, icon, children }: { id: string; label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#4b4d55]">
        {label}
      </label>
      <div className="flex h-[38px] items-center gap-2 rounded-[3px] border border-border-strong bg-white px-[11px] text-muted-foreground focus-within:border-primary focus-within:outline-2 focus-within:outline-primary-soft">
        {icon}
        {children}
      </div>
    </div>
  );
}

export function CampoSenha({
  id,
  label,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <Campo id={id} label={label} icon={<Lock className="h-[15px] w-[15px]" />}>
      <input
        id={id}
        type={visivel ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="text-dimmer hover:text-muted-foreground"
      >
        {visivel ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
      </button>
    </Campo>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-primary bg-primary-soft px-3 py-[9px] text-[12.5px] leading-normal text-primary-dark">
      {children}
    </div>
  );
}
