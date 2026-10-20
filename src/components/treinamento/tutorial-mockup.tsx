import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, MapPin } from "lucide-react";
import { PageHead } from "@/components/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Tutorial ilustrado do Centro de Treinamento: cada passo mostra uma tela desenhada no estilo do portal (dados
// fictícios) com marcadores numerados nos pontos de clique, e as instruções ao lado com os mesmos números.
// Telas montadas com as primitivas abaixo (M*), sem chamar o servidor.

export interface PassoTutorial {
  id: string;
  titulo: string;
  /** Menu do portal onde a tela fica. */
  onde: string;
  explicacao: string;
  /** Instruções; o índice (1, 2, 3…) é o número do marcador na tela. */
  acoes: string[];
  dica?: string;
  tela: () => ReactNode;
}

export interface Tutorial {
  slug: string;
  titulo: string;
  subtitulo: string;
  passos: PassoTutorial[];
}

export function TutorialMockup({ tutorial }: { tutorial: Tutorial }) {
  const [i, setI] = useState(0);
  const p = tutorial.passos[i];
  const ultimo = i === tutorial.passos.length - 1;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(tutorial.passos.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [tutorial.passos.length]);

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title={tutorial.titulo}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/treinamento">Voltar ao Centro de Treinamento</Link>
          </Button>
        }
      >
        {tutorial.subtitulo} Os dados das telas são fictícios.
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <nav
          aria-label="Passos do tutorial"
          className="rounded-[10px] border bg-card px-3 py-3 xl:sticky xl:top-0"
        >
          <p className="mb-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Passo {i + 1} de {tutorial.passos.length}
          </p>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <i
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${((i + 1) / tutorial.passos.length) * 100}%` }}
            />
          </div>
          <ol className="flex flex-col gap-0.5">
            {tutorial.passos.map((x, k) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setI(k)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] leading-snug",
                    k === i ? "bg-primary-soft font-semibold text-primary" : "hover:bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      k < i
                        ? "bg-success text-white"
                        : k === i
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {k < i ? "✓" : k + 1}
                  </span>
                  {x.titulo}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-[15px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-extrabold tracking-[-0.01em]">{p.titulo}</h2>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {p.onde}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed">{p.explicacao}</p>
              </div>
            </div>
            <div className="mt-4 grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">{p.tela()}</div>
              <div className="flex flex-col gap-3">
                <ol className="flex flex-col gap-2.5">
                  {p.acoes.map((a, k) => (
                    <li key={k} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      <Num n={k + 1} />
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
                {p.dica && (
                  <div className="flex items-start gap-2 rounded-[10px] bg-info-soft px-3 py-2.5 text-[12.5px] text-info">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{p.dica}</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>
              <ArrowLeft /> Anterior
            </Button>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              Dica: use as setas ← → do teclado
            </span>
            {ultimo ? (
              <Button asChild>
                <Link to="/treinamento">
                  <CheckCircle2 /> Concluir tutorial
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setI(i + 1)}>
                Próximo <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================ primitivas das telas (mockup)

/** Marcador numerado: o mesmo número da instrução ao lado. */
export function Num({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[oklch(0.62_0.2_45)] text-[11.5px] font-extrabold text-white shadow-[0_0_0_3px_oklch(0.62_0.2_45/0.25)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/** Envolve um elemento da tela com o marcador no canto e um contorno de destaque. */
export function Alvo({
  n,
  children,
  className,
  canto = "dir",
}: {
  n: number;
  children: ReactNode;
  className?: string;
  canto?: "dir" | "esq";
}) {
  return (
    <div
      className={cn(
        "relative rounded-[10px] outline outline-2 outline-offset-2 outline-[oklch(0.62_0.2_45/0.7)]",
        className,
      )}
    >
      {children}
      <Num n={n} className={cn("absolute -top-3 z-10", canto === "dir" ? "-right-3" : "-left-3")} />
    </div>
  );
}

/** Janela do portal: barra de título, menu lateral resumido e trilha. */
export function MJanela({
  trilha,
  titulo,
  menu,
  children,
}: {
  trilha: string;
  titulo: string;
  menu: string;
  children: ReactNode;
}) {
  const itens = [
    "Página Inicial",
    "Disparo de Cobranças e Documentos",
    "DocuSign",
    "Régua de Cobrança",
    "Centro de Treinamento",
    "Integrações",
  ];
  return (
    <div
      className="overflow-hidden rounded-xl border-[1.5px] border-border-strong bg-background shadow-card"
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b bg-secondary px-3 py-2">
        <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate rounded-md bg-card px-2.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
          imobenviomassa.vercel.app
        </span>
      </div>
      <div className="flex">
        <div className="hidden w-[150px] shrink-0 flex-col gap-0.5 border-r bg-sidebar p-2 md:flex">
          <b className="mb-1.5 px-1.5 text-[11.5px]">Disparo de Cobranças e Documentos</b>
          {itens.map((t) => (
            <span
              key={t}
              className={cn(
                "truncate rounded-md px-1.5 py-1 text-[10.5px]",
                t === menu ? "bg-primary font-semibold text-white" : "text-muted-foreground",
              )}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-3.5">
          <p className="text-[10px] text-muted-foreground">{trilha}</p>
          <h3 className="mb-3 text-[15px] font-extrabold tracking-[-0.01em]">{titulo}</h3>
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function MCard({
  titulo,
  children,
  className,
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[10px] border bg-card p-3", className)}>
      {titulo && <b className="mb-2 block text-[12.5px]">{titulo}</b>}
      {children}
    </div>
  );
}

export function MBotao({
  children,
  tipo = "primario",
  className,
}: {
  children: ReactNode;
  tipo?: "primario" | "contorno";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-[7px] px-2.5 text-[11.5px] font-semibold",
        tipo === "primario" ? "bg-primary text-white" : "border border-border-strong bg-card",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MSelo({
  children,
  tom,
}: {
  children: ReactNode;
  tom?: "success" | "warning" | "danger" | "info";
}) {
  const c = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-primary-soft text-primary-dark",
    info: "bg-info-soft text-info",
  };
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold",
        tom ? c[tom] : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function MCampo({
  rotulo,
  valor,
  vazio,
}: {
  rotulo: string;
  valor?: string;
  vazio?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold">{rotulo}</span>
      <span
        className={cn(
          "flex h-7 items-center truncate rounded-[6px] border border-border-strong bg-card px-2 text-[11px]",
          !valor && "text-muted-foreground",
        )}
      >
        {valor || vazio || ""}
      </span>
    </div>
  );
}

export function MOpcao({
  ativo,
  titulo,
  texto,
}: {
  ativo?: boolean;
  titulo: string;
  texto?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[9px] border-[1.5px] p-2.5",
        ativo ? "border-primary bg-primary-soft" : "border-border bg-card",
      )}
    >
      <b className="block text-[12px]">{titulo}</b>
      {texto && <span className="text-[10.5px] text-muted-foreground">{texto}</span>}
    </div>
  );
}

export function MPassos({ passos, atual }: { passos: string[]; atual: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {passos.map((t, k) => (
        <span
          key={t}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
            k + 1 === atual
              ? "border-primary bg-primary-soft text-primary"
              : k + 1 < atual
                ? "border-success/40 text-success"
                : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "grid h-4 w-4 place-items-center rounded-full text-[9px] text-white",
              k + 1 === atual
                ? "bg-primary"
                : k + 1 < atual
                  ? "bg-success"
                  : "bg-muted-foreground/50",
            )}
          >
            {k + 1 < atual ? "✓" : k + 1}
          </span>
          {t}
        </span>
      ))}
    </div>
  );
}

export function MTabela({
  colunas,
  linhas,
  destaque,
}: {
  colunas: string[];
  linhas: ReactNode[][];
  destaque?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-[8px] border">
      <table className="w-full text-[10.5px]">
        <thead className="bg-secondary text-left">
          <tr>
            {colunas.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.05em] text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, k) => (
            <tr
              key={k}
              className={cn(
                "border-t",
                k === destaque &&
                  "bg-primary-soft outline outline-2 -outline-offset-2 outline-primary",
              )}
            >
              {l.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-2 py-1.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MCheck({ marcado }: { marcado?: boolean }) {
  return (
    <span
      className={cn(
        "inline-grid h-3.5 w-3.5 place-items-center rounded-[3px] border text-[9px] text-white",
        marcado ? "border-primary bg-primary" : "border-border-strong bg-card",
      )}
    >
      {marcado ? "✓" : ""}
    </span>
  );
}
