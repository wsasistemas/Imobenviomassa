import { useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, CircleCheckBig, Eye, EyeOff, Lock, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import wsaLogo from "@/assets/wsa-logo.png";
import { SimboloDocuSign, SimboloWhatsApp } from "@/components/icones/marcas";
import { BoletoIlustracao } from "@/components/login/boleto-ilustracao";
import { cn } from "@/lib/utils";

// Tela de entrada no design system da entrada do ImobDesk (imobdesk.imobsystems.com.br/login, 24/10/2026):
// marca em duas linhas, etiqueta abóbora de cantos retos, título branco grande, campos retos de 54 px com ícone,
// olho na senha, "Lembrar meu e-mail", botão em degradê azul → abóbora. A cena do boleto (BoletoIlustracao) ocupa
// o painel da esquerda. Vale para /auth, /redefinir-senha e /trocar-senha. Estilos em styles.css (.tela-entrada, .ent-*).

const ANO = new Date().getFullYear();

const tileCor = (cor: string) => ({ ["--c" as string]: cor });

function Numero({ icone, valor, rotulo }: { icone: ReactNode; valor: string; rotulo: string }) {
  return (
    <li>
      <span>{icone}</span>
      <b>{valor}</b>
      <small>{rotulo}</small>
    </li>
  );
}

const tileCanal = "hig-tile h-8 w-8 rounded-lg shadow-[0_0_0_2px_oklch(0.2_0.05_255)]";

/** Tela de entrada: cena do boleto à esquerda, formulário à direita (sempre clara). */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tela-entrada mpl-root">
      {/* ===== Painel da esquerda (estrutura .mpl-* do ImobDesk; a cena do boleto no lugar da foto) ===== */}
      <aside className="mpl-visual" aria-label="Disparo de Cobranças · WSA Sistemas">
        <BoletoIlustracao className="absolute inset-0" />
        <div className="mpl-scrim" aria-hidden="true" />

        <div className="mpl-brand">
          <span className="mpl-mark">
            <img src={wsaLogo} alt="" width={44} height={44} />
          </span>
          <span className="mpl-brand__nome">
            Disparo de Cobranças
            <small>WSA Sistemas</small>
          </span>
        </div>

        {/* No ImobDesk o bloco fica no meio; aqui desce para a base para não cobrir o boleto. */}
        <div className="mpl-pitch mt-auto">
          <span className="mpl-tag">Cobranças e documentos em lote</span>
          <h1 className="mpl-titulo">Cobrança e assinatura no cliente certo.</h1>
          <p className="mpl-texto">
            Boletos por WhatsApp e e-mail com régua de 30, 60 e 90 dias, e documentos para assinatura pelo DocuSign
            — tudo num painel só, com histórico completo.
          </p>
        </div>

        <ul className="mpl-metrics">
          <Numero
            icone={
              <span className="flex">
                <span className={tileCanal} style={tileCor("var(--marca-whatsapp)")} title="WhatsApp">
                  <SimboloWhatsApp size={17} />
                </span>
                <span
                  className={cn(tileCanal, "-ml-1.5 text-[oklch(0.2_0.02_255)]")}
                  style={tileCor("var(--marca-docusign)")}
                  title="DocuSign"
                >
                  <SimboloDocuSign size={18} />
                </span>
                <span className={cn(tileCanal, "-ml-1.5")} style={tileCor("var(--sys-blue)")} title="E-mail">
                  <Mail size={17} strokeWidth={2.2} />
                </span>
              </span>
            }
            valor="3 canais"
            rotulo="WhatsApp · DocuSign · E-mail"
          />
          <Numero
            icone={
              <span className="hig-tile h-8 w-8 rounded-lg" style={tileCor("var(--sys-orange)")}>
                <CalendarClock size={18} strokeWidth={2.2} />
              </span>
            }
            valor="30·60·90"
            rotulo="Faixas da régua"
          />
          <Numero
            icone={
              <span className="hig-tile h-8 w-8 rounded-lg" style={tileCor("var(--sys-green)")}>
                <ShieldCheck size={18} strokeWidth={2.2} />
              </span>
            }
            valor="100%"
            rotulo="Envios auditados"
          />
        </ul>
      </aside>

      {/* ===== Acesso (direita) ===== */}
      <main className="mpl-panel">
        <div className="mpl-panel__conteudo">{children}</div>
        <p className="mpl-legal">© {ANO} WSA Sistemas. Todos os direitos reservados.</p>
      </main>
    </div>
  );
}

export const inputCls =
  "h-full w-full min-w-0 border border-[oklch(0.82_0.022_40)] bg-white pl-11 pr-3.5 text-[17px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-[oklch(0.6_0.02_255)] hover:border-foreground/50 focus:border-primary focus:shadow-[0_0_0_4px_oklch(0.55_0.11_250/0.22)]";
/** Botão principal da entrada: degradê azul → abóbora, 56 px, seta (.ent-botao em styles.css). */
export const submitCls = "ent-botao";

export function LoginCard({
  titulo,
  sub,
  kicker = "Acesso do colaborador",
  onSubmit,
  children,
}: {
  titulo: string;
  sub?: string;
  kicker?: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mpl-kicker">{kicker}</p>
      <h2 className="mpl-entrar">{titulo}</h2>
      {sub && <p className="mpl-sub">{sub}</p>}
      <form onSubmit={onSubmit} noValidate className="mpl-form">
        {children}
      </form>
    </div>
  );
}

export function Campo({
  id,
  label,
  icon,
  acao,
  children,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  /** Botão dentro do campo, à direita (ex.: olho da senha). */
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground">
        {label}
      </label>
      <div className="group relative h-[54px] text-[oklch(0.6_0.02_255)] focus-within:text-primary">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</span>
        {children}
        {acao && <span className="absolute right-1 top-1/2 -translate-y-1/2">{acao}</span>}
      </div>
    </div>
  );
}

/** Ícone de linha do campo (cinza; azul quando o campo está em foco). */
export const iconeCampo = (Icone: typeof Mail) => <Icone size={16} strokeWidth={2} aria-hidden="true" />;

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
    <Campo
      id={id}
      label={label}
      icon={iconeCampo(Lock)}
      acao={
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-controls={id}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="grid h-11 w-11 place-items-center text-[rgb(107_114_128)] hover:text-foreground"
        >
          {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    >
      <input
        id={id}
        type={visivel ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, "pr-[52px]")}
      />
    </Campo>
  );
}

/** Aviso da entrada: erro (vermelho, role=alert) ou confirmação (verde, role=status). */
export function Aviso({ children, tom = "erro" }: { children: ReactNode; tom?: "erro" | "ok" }) {
  const ok = tom === "ok";
  const Icone = ok ? CircleCheckBig : TriangleAlert;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2.5 border-l-[3px] px-3.5 py-3 text-[15px] font-semibold leading-snug",
        ok
          ? "border-success bg-success-soft text-[oklch(0.36_0.09_150)]"
          : "border-destructive bg-[oklch(0.95_0.03_27)] text-[oklch(0.4_0.15_27)]",
      )}
    >
      <Icone size={20} strokeWidth={2.2} className={cn("mt-px shrink-0", ok ? "text-success" : "text-destructive")} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Linha "Lembrar meu e-mail" + link à direita (ex.: "Esqueceu a senha?"). */
export function LinhaLembrar({
  lembrar,
  onLembrar,
  children,
}: {
  lembrar: boolean;
  onLembrar: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] text-[oklch(0.47_0.025_255)]">
        <input
          type="checkbox"
          checked={lembrar}
          onChange={(e) => onLembrar(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        Lembrar meu e-mail
      </label>
      {children}
    </div>
  );
}

/** Link da entrada (azul escuro sublinhado, área de toque de 44 px). */
export const linkEntradaCls =
  "min-h-11 text-[15px] font-semibold text-primary-dark underline underline-offset-4 hover:text-primary";

/** Nota no pé do formulário. */
export function NotaEntrada({ children }: { children: ReactNode }) {
  return (
    <p className="mpl-note">{children}</p>
  );
}
