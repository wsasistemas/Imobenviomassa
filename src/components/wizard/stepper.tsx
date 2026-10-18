import { Link, useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  key: string;
  label: string;
  path: string;
};

export const WIZARD_STEPS: WizardStep[] = [
  { key: "origem", label: "Origem", path: "/disparo/novo/origem" },
  { key: "compradores", label: "Compradores", path: "/disparo/novo/compradores" },
  { key: "modelo", label: "Modelo", path: "/disparo/novo/modelo" },
  { key: "verificacao", label: "Verificação", path: "/disparo/novo/verificacao" },
  { key: "assinatura", label: "Assinatura", path: "/disparo/novo/assinatura" },
  { key: "revisao", label: "Revisão", path: "/disparo/novo/revisao" },
];

export function Stepper() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const currentIdx = WIZARD_STEPS.findIndex((s) => pathname.startsWith(s.path));

  return (
    <nav aria-label="Progresso" className="w-full">
      <ol className="flex items-center gap-2">
        {WIZARD_STEPS.map((step, idx) => {
          const status =
            idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
          const clickable = idx <= currentIdx;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <Link
                to={step.path}
                disabled={!clickable}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  status === "current" &&
                    "bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                  status === "done" &&
                    "bg-primary/10 text-primary hover:bg-primary/20",
                  status === "todo" &&
                    "bg-muted text-muted-foreground pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    status === "current" && "bg-primary-foreground/20",
                    status === "done" && "bg-primary/20",
                    status === "todo" && "bg-muted-foreground/20",
                  )}
                >
                  {status === "done" ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </Link>
              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1",
                    idx < currentIdx ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
