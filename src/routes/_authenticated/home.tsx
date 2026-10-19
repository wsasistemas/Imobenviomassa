import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  CircleCheckBig,
  Clock,
  FileSignature,
  Megaphone,
  Send,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useResumoDisparos } from "@/hooks/use-resumo-disparos";
import { formatarNome } from "@/components/app-shell";
import { IconeDoMenu, IconeIlustrativo } from "@/components/icones/icone-colorido";
import {
  ancestorsOf,
  menuChildrenOf,
  menuGroups,
  menuItemsByGroup,
  type MenuItem,
  type PermissionId,
} from "@/config/menu-registry";

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
  const navigate = useNavigate();
  const [escolher, setEscolher] = useState(false);
  // Novo disparo: boleto (Régua de Cobrança) ou documento (DocuSign) — só os tipos que o perfil pode abrir.
  const tiposDisparo = [
    {
      id: "boleto",
      to: "/regua-cobranca/novo",
      icon: Banknote,
      titulo: "Boleto",
      texto:
        "Régua de Cobrança: boletos a vencer ou em atraso (30, 60, 90 dias) por WhatsApp e e-mail.",
      acao: "Montar lote de boletos",
      pode: canOpen("regua_lote_criar"),
    },
    {
      id: "docusign",
      to: "/disparo/novo",
      icon: FileSignature,
      titulo: "DocuSign",
      texto: "Documentos para assinatura: empreendimento, compradores e modelo DocuSign.",
      acao: "Enviar para assinatura",
      pode: canOpen("criar_disparo"),
    },
  ].filter((t) => t.pode);
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
        <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
          {dataPorExtenso}
        </p>
      </div>

      {tiposDisparo.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[radial-gradient(120%_140%_at_100%_0%,oklch(0.62_0.19_3)_0%,oklch(0.42_0.15_5)_60%,oklch(0.3_0.08_15)_100%)] px-7 py-6 text-white">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
              Escolha o tipo de disparo
            </h2>
            <p className="mt-1 max-w-[620px] text-[13.5px] text-white/85">
              Envie em lote <b>boletos</b> de cobrança (a vencer ou em atraso) por WhatsApp e
              e-mail, ou <b>documentos para assinatura</b> pelo DocuSign. Clique em Novo disparo e
              escolha o tipo: o sistema abre o passo a passo de cada um.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              tiposDisparo.length === 1 ? navigate({ to: tiposDisparo[0].to }) : setEscolher(true)
            }
            className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-white px-4 text-[13.5px] font-semibold text-foreground hover:bg-white/90"
          >
            <IconeIlustrativo icon={Send} size={16} />
            Novo disparo
          </button>
        </div>
      )}

      <Dialog open={escolher} onOpenChange={setEscolher}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Qual tipo de disparo?</DialogTitle>
            <DialogDescription>
              Escolha o que vai enviar. Cada opção abre o próprio passo a passo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {tiposDisparo.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setEscolher(false);
                  navigate({ to: t.to });
                }}
                className="flex flex-col gap-2 rounded-[13px] border-[1.5px] border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft"
              >
                <IconeIlustrativo icon={t.icon} size={32} />
                <b className="text-[15px]">{t.titulo}</b>
                <span className="text-[12.5px] text-muted-foreground">{t.texto}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
                  {t.acao} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {verResumo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="flex items-center gap-3.5 rounded-xl border bg-card p-4 shadow-card"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-secondary">
                <IconeIlustrativo icon={k.icon} size={28} />
              </span>
              <div>
                <div className="text-[26px] font-extrabold leading-none tracking-[-0.02em]">
                  {k.valor}
                </div>
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
            ? ramos.map((r) => ({
                id: r.id,
                titulo: r.path ? g.label : r.label,
                telas: telasDe(r, canOpen),
              }))
            : [{ id: g.id, titulo: g.label, telas: ramos.flatMap((r) => telasDe(r, canOpen)) }];
        return secoes
          .filter((s) => s.telas.length > 0)
          .map((s) => (
            <section key={s.id}>
              <h2 className="mb-3 mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {s.titulo}
              </h2>
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
  const origem = ancestorsOf(item.id)
    .slice(1, -1)
    .map((m) => m.label)
    .join(" › ");
  return (
    <Link
      to={item.path}
      className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_30px_-14px_oklch(0.4_0.1_10/0.35)]"
    >
      <IconeDoMenu id={item.id} icon={item.icon} tamanho={30} />
      <div>
        {origem && (
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {origem}
          </p>
        )}
        <h3 className="flex items-center gap-2 text-[16px] font-bold">
          {item.label}
          {item.emConstrucao && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              Em construção
            </span>
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
