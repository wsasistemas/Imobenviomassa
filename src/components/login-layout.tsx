import { useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Eye, EyeOff, Lock, Send, ShieldCheck } from "lucide-react";
import wsaLogo from "@/assets/wsa-logo.png";

// Layout e campos da tela de entrada — padrão do Portal DP e do Gestão de Contratos.

const ANO = new Date().getFullYear();

const RECURSOS = [
  { icon: Send, texto: "Envio de documentos em massa via DocuSign" },
  { icon: BarChart3, texto: "Acompanhamento das assinaturas em tempo real" },
  { icon: ShieldCheck, texto: "Controle de acesso por perfil" },
];

/** Tela de entrada (login, senha): painel nas cores da logo WSA à esquerda, cartão à direita (tema .tema-wsa em styles.css). */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tema-wsa grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* ===== Painel escuro (esquerda) ===== */}
      <aside className="relative flex flex-col overflow-hidden bg-[radial-gradient(120%_140%_at_100%_0%,var(--wsa-azul-claro)_0%,var(--wsa-azul)_38%,var(--wsa-azul-escuro)_70%,var(--wsa-marinho)_100%)] px-4 py-6 text-white md:px-[clamp(20px,3vw,40px)] md:pb-4">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--wsa-laranja)] via-[var(--wsa-vermelho)] to-[var(--wsa-azul-claro)]"
        />
        <img
          src={wsaLogo}
          alt="WSA Sistemas IA"
          className="block h-16 w-16 self-start rounded-full ring-2 ring-white/70 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] md:h-20 md:w-20"
        />

        <div className="flex max-w-[440px] flex-1 flex-col justify-center pt-6 md:py-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffc27a]">
            WSA Sistemas IA
          </p>
          <h1 className="mb-2.5 text-[clamp(26px,2.6vw,34px)] font-extrabold tracking-[-0.02em]">
            Disparo em Massa
          </h1>
          <span
            aria-hidden
            className="mb-3.5 block h-1 w-16 rounded-full bg-gradient-to-r from-[var(--wsa-laranja)] to-[var(--wsa-vermelho)]"
          />
          <p className="text-sm leading-relaxed text-white/80 md:border-b md:border-white/15 md:pb-5 md:text-[13.5px]">
            Plataforma corporativa para envio de documentos para assinatura via DocuSign, com gestão
            centralizada das campanhas.
          </p>
          <ul className="mt-5 hidden flex-col gap-2.5 text-[13px] text-white/90 md:flex">
            {RECURSOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-white/20 bg-white/10 text-[#ffb35c]">
                  <Icon className="h-[15px] w-[15px]" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-[11.5px] text-white/60 md:block">© {ANO} WSA Sistemas</p>
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
  "inline-flex h-[38px] items-center justify-center gap-2 rounded-[9px] bg-primary text-[13.5px] font-semibold text-primary-foreground shadow-brand hover:bg-primary-dark disabled:opacity-55";

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
    <div className="rounded-lg border border-[#f5b5b3] bg-[#fdecea] px-3 py-[9px] text-[12.5px] leading-normal text-[#b3261e]">
      {children}
    </div>
  );
}
