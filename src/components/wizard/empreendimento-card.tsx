import { Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS = ["#8b5cf6", "#06b6d4", "#22c55e", "#f97316", "#ec4899", "#3b82f6"];

export function empreendimentoAccent(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

type Props = {
  codigo: string;
  nome: string;
  subtitulo?: string;
  selected?: boolean;
  loading?: boolean;
  onClick?: () => void;
};

export function EmpreendimentoCard({ codigo, nome, subtitulo, selected, loading, onClick }: Props) {
  const accent = empreendimentoAccent(codigo);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 pb-5 text-left transition-all",
        "hover:border-primary/50 hover:shadow-md",
        selected && "border-primary ring-2 ring-primary/30 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-muted-foreground/70">{codigo}</span>
        <Building2 className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <div className="mt-6 min-h-[44px] flex flex-col items-center justify-center text-center">
        <div className="text-sm font-bold uppercase tracking-wide leading-tight">{nome}</div>
        {subtitulo && (
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {subtitulo}
          </div>
        )}
      </div>
      <span
        className="absolute inset-x-4 bottom-2 h-1 rounded-full"
        style={{ backgroundColor: accent }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
    </button>
  );
}
