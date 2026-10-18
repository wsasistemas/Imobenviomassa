import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheckBig, Clock, Megaphone, Send, TrendingUp } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useResumoDisparos } from "@/hooks/use-resumo-disparos";
import { formatarNome } from "@/components/app-shell";
import { IconeDoMenu, IconeIlustrativo } from "@/components/icones/icone-colorido";
import { ancestorsOf, menuChildrenOf, menuGroups, menuItemsByGroup, type MenuItem, type PermissionId } from "@/config/menu-registry";

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

/** Telas (itens com rota) de um ramo do menu, na ordem do registro. */
function telasDe(item: MenuItem, canOpen: (id: PermissionId) => boolean): MenuItem[] {
  if (!canOpen(item.id)) return [];
  if (item.path) return [item];
  return menuChildrenOf(item.id)
    .filter((c) => !c.section)
    .flatMap((c) => telasDe(c, canOpen));
}

function HomePage() {
  const { fullName, canOpen, podeAcessar } = useCurrentUser();
  const verResumo = podeAcessar("ver_dashboard");
  const resumo = useResumoDisparos({ enabled: verResumo });
  const fmt = (n: number) => (resumo.isLoading ? "…" : n.toLocaleString("pt-BR"));

  const kpis = [
    { label: "Disparos hoje", valor: fmt(resumo.totalHoje), icon: Megaphone },
    { label: "Documentos enviados", valor: fmt(resumo.totalEnviados), icon: CircleCheckBig },
    { label: "Aguardando assinatura", valor: fmt(resumo.aguardando), icon: Clock },
    { label: "Com problema", valor: fmt(resumo.totalErros), icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">
          {saudacao()}, {formatarNome(fullName).split(" ")[0]}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">{dataPorExtenso}</p>
      </div>

      {canOpen("criar_disparo") && (
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[radial-gradient(120%_140%_at_100%_0%,oklch(0.62_0.19_3)_0%,oklch(0.42_0.15_5)_60%,oklch(0.3_0.08_15)_100%)] px-7 py-6 text-white">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Envie documentos para assinatura em lote</h2>
            <p className="mt-1 max-w-[560px] text-[13.5px] text-white/85">
              Escolha o empreendimento, os compradores e o modelo DocuSign. O sistema dispara e acompanha cada
              assinatura.
            </p>
          </div>
          <Link
            to="/disparo/novo"
            className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-white px-4 text-[13.5px] font-semibold text-foreground hover:bg-white/90"
          >
            <IconeIlustrativo icon={Send} size={16} />
            Novo disparo
          </Link>
        </div>
      )}

      {verResumo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-card">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-secondary">
                <IconeIlustrativo icon={k.icon} size={28} />
              </span>
              <div>
                <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em]">{k.valor}</div>
                <div className="mt-1 text-[12px] font-medium text-muted-foreground">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {menuGroups.map((g) => {
        // Na Página Inicial cada ramo de primeiro nível vira uma seção (ex.: "Disparo em Massa").
        const ramos = menuItemsByGroup(g.id).filter((m) => m.id !== "home");
        const secoes =
          g.id === "principal"
            ? ramos.map((r) => ({ id: r.id, titulo: r.path ? g.label : r.label, telas: telasDe(r, canOpen) }))
            : [{ id: g.id, titulo: g.label, telas: ramos.flatMap((r) => telasDe(r, canOpen)) }];
        return secoes
          .filter((s) => s.telas.length > 0)
          .map((s) => (
            <section key={s.id}>
              <h2 className="mb-3 mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{s.titulo}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {s.telas.map((item) => (
                  <ModuleCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ));
      })}
    </div>
  );
}

function ModuleCard({ item }: { item: MenuItem }) {
  // Subtítulo com o submenu de origem (ex.: "DocuSign"), quando houver.
  const origem = ancestorsOf(item.id).slice(1, -1).map((m) => m.label).join(" › ");
  return (
    <Link
      to={item.path}
      className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_30px_-14px_oklch(0.4_0.1_10/0.35)]"
    >
      <IconeDoMenu id={item.id} icon={item.icon} tamanho={30} />
      <div>
        {origem && <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{origem}</p>}
        <h3 className="flex items-center gap-2 text-[16px] font-bold">
          {item.label}
          {item.emConstrucao && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">Em construção</span>
          )}
        </h3>
      </div>
      <p className="text-[13px] leading-normal text-muted-foreground">{item.description}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-primary transition-all group-hover:gap-2.5">
        Abrir
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
