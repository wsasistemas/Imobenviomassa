import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Permissao } from "@/lib/permissoes";

/** Cabeçalho de página (padrão Portal DP: .page-head com h1 22px, subtítulo e ações). */
export function PageHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[18px] font-bold">{title}</h1>
        {children && <p className="mt-1 max-w-[720px] text-[13px] leading-normal text-muted-foreground">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Painel/cartão genérico (padrão .panel). */
export function Panel({
  title,
  sub,
  children,
  className,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[10px] border bg-card px-4 py-3.5", className)}>
      {title && <h2 className="mb-1 flex items-center gap-2 text-[14px] font-bold">{title}</h2>}
      {sub && <p className="mb-3 text-[12px] leading-normal text-muted-foreground">{sub}</p>}
      {children}
    </section>
  );
}

/** Aviso de área não liberada para o perfil (padrão "Acesso não liberado"). */
export function SemAcesso({ texto = "Seu perfil não tem permissão para esta área. Fale com o administrador do sistema." }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[10px] border bg-card px-4 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="text-[17px] font-bold">Acesso não liberado</h1>
      <p className="max-w-[420px] text-[13px] text-muted-foreground">{texto}</p>
      <Link to="/home" className="text-[13px] font-semibold text-primary hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}

/** Selo (badge) no padrão do DP. */
export function Selo({ children, tom }: { children: ReactNode; tom?: "info" | "warning" | "success" | "danger" }) {
  const cls = {
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    danger: "bg-primary-soft text-primary-dark",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.02em]",
        tom ? cls[tom] : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Libera o conteúdo só para quem tem a permissão; senão mostra "Acesso não liberado". */
export function ComAcesso({ permissao, children }: { permissao: Permissao; children: ReactNode }) {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  return pode(permissao) ? <>{children}</> : <SemAcesso />;
}
