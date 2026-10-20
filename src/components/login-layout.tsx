import { useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Eye, EyeOff, Lock, MessageCircle, Send, ShieldCheck } from "lucide-react";
import wsaLogo from "@/assets/wsa-logo.png";

// Layout e campos da tela de entrada — padrão do Portal DP e do Gestão de Contratos.

const ANO = new Date().getFullYear();

const RECURSOS = [
  { icon: Send, texto: "Envio de documentos em massa via DocuSign" },
  { icon: MessageCircle, texto: "Régua de cobrança por WhatsApp e e-mail" },
  { icon: BarChart3, texto: "Acompanhamento das assinaturas e cobranças em tempo real" },
  { icon: ShieldCheck, texto: "Controle de acesso por perfil" },
];

/** Tela de entrada (login, senha): painel marinho à esquerda, cartão à direita (paleta .tema-entrada em styles.css). */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tema-entrada grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* ===== Painel escuro (esquerda) ===== */}
      <aside className="relative flex flex-col overflow-hidden bg-[radial-gradient(120%_120%_at_15%_10%,#17457a_0%,var(--ent-navy-800)_42%,var(--ent-navy-900)_100%)] px-4 py-6 text-white md:px-[clamp(20px,3vw,40px)] md:pb-4">
        {/* brilhos e textura em grade, como na entrada do portal Anglo-Americano */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-20 h-[420px] w-[420px] rounded-full bg-[#1e4e86] opacity-40 blur-[80px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-20 h-[360px] w-[360px] rounded-full bg-[var(--ent-verde-400)] opacity-[0.28] blur-[80px]"
        />
        <span aria-hidden className="tema-entrada-grade pointer-events-none absolute inset-0" />

        <img
          src={wsaLogo}
          alt="WSA Sistemas IA"
          className="relative block h-16 w-16 self-start rounded-full border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.25)] md:h-20 md:w-20"
        />

        <div className="relative flex max-w-[440px] flex-1 flex-col justify-center pt-6 md:py-8">
          <p className="mb-2 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ent-dourado)]">
            <span aria-hidden className="inline-block h-px w-[22px] bg-[var(--ent-dourado)]" />
            WSA Sistemas IA
          </p>
          <h1 className="mb-2.5 text-[clamp(26px,2.6vw,34px)] font-extrabold tracking-[-0.02em] text-[#f3f7fc]">
            Disparo de Cobranças e Documentos
          </h1>
          <p className="text-sm leading-relaxed text-[#b7c6d9] md:border-b md:border-white/15 md:pb-5 md:text-[13.5px]">
            Plataforma corporativa para envio de documentos para assinatura via DocuSign e da régua de
            cobrança por WhatsApp e e-mail, com gestão centralizada das campanhas.
          </p>
          <ul className="mt-5 hidden flex-col gap-2.5 text-[13px] text-[#dce6f2] md:flex">
            {RECURSOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/15 bg-white/[0.08] text-[var(--ent-dourado)] backdrop-blur-sm">
                  <Icon className="h-[15px] w-[15px]" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden text-[11.5px] text-[#9fb2c9] md:block">
          © {ANO} WSA Sistemas
        </p>
      </aside>

      {/* ===== Formulário (direita) ===== */}
      <main className="flex flex-col items-center justify-center gap-4 bg-background px-4 pb-8 pt-6 md:px-5 md:py-8">
        {children}
        <p className="text-center text-[11.5px] text-dimmer">
          © {ANO} WSA Sistemas. Todos os direitos reservados.
        </p>
      </main>
    </div>
  );
}

export const inputCls =
  "h-full min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-dimmer";
export const submitCls =
  "inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] bg-primary bg-gradient-to-b from-[var(--ent-verde-400)] to-primary text-[13.5px] font-semibold text-primary-foreground shadow-brand transition hover:-translate-y-px hover:to-primary-dark disabled:translate-y-0 disabled:opacity-55";

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
      className="flex w-full max-w-[360px] flex-col gap-3.5 rounded-2xl border bg-card px-5 py-6 shadow-card md:px-7 md:py-7"
    >
      <div>
        <h2 className="mb-1 text-[20px] font-extrabold tracking-[-0.01em]">{titulo}</h2>
        <p className="text-[13px] text-muted-foreground">{sub}</p>
      </div>
      {children}
    </form>
  );
}

export function Campo({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-foreground">
        {label}
      </label>
      <div className="flex h-[38px] items-center gap-2 rounded-[7px] border border-border-strong bg-card px-[11px] text-muted-foreground focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
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
    <div className="rounded-lg border border-[#f4c7c3] bg-[#fdf0ef] px-3 py-[9px] text-[12.5px] leading-normal text-[#b42318]">
      {children}
    </div>
  );
}
