import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Home, UserRound } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatarNome } from "@/components/app-shell";
import { gruposVisiveis, perfilPrincipal, type NavLeaf } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

// Data por extenso, ex.: "terça-feira, 29 de setembro de 2026".
const dataPorExtenso = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function HomePage() {
  const { fullName, roles, pode, souSuperAdminCentral } = useCurrentUser();
  const role = perfilPrincipal(roles);

  return (
    <div className="flex flex-col gap-4">
      {/* Banner de boas-vindas */}
      <div className="flex items-center gap-4 rounded-xl bg-sidebar px-5 py-4 text-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <h1 className="mb-1 text-[17px] font-bold">
            {saudacao()}, {formatarNome(fullName)}!
          </h1>
          <div className="flex flex-wrap gap-4 text-[12.5px] text-sidebar-foreground">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              {role}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {dataPorExtenso}
            </span>
          </div>
        </div>
      </div>

      {gruposVisiveis(pode, souSuperAdminCentral).map((grupo) => (
        <section key={grupo.id}>
          <h2 className="mb-3 mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {grupo.label}
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.children.map((item) => (
              <ModuleCard key={item.to} item={item} highlighted={item.to === "/disparo/novo"} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ModuleCard({ item, highlighted }: { item: NavLeaf; highlighted?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex flex-col items-start rounded-[10px] border bg-card p-4 transition-all hover:-translate-y-px hover:border-primary hover:shadow-[0_6px_18px_-8px_rgba(214,41,59,0.35)]",
        highlighted && "border-primary shadow-[0_6px_18px_-8px_rgba(214,41,59,0.35)]",
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-1 text-[14px] font-bold">{item.label}</h3>
      <p className="mb-3.5 text-[12.5px] leading-normal text-muted-foreground">{item.descricao}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.04em] text-primary transition-all group-hover:gap-[9px]">
        Acessar módulo
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
