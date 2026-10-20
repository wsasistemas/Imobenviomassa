import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Clock,
  FileSignature,
  ListChecks,
  MonitorPlay,
  Send,
} from "lucide-react";
import { PageHead, Selo } from "@/components/page";
import { Button } from "@/components/ui/button";
import { guiaDisparoEmMassa } from "@/lib/treinamento/disparo-em-massa";
import { tutorialDocusign } from "@/components/treinamento/tutorial-docusign";
import { tutorialRegua } from "@/components/treinamento/tutorial-regua";

const TUTORIAIS = [
  {
    to: "/treinamento/tutorial-boleto" as const,
    icon: Banknote,
    titulo: "Tutorial: disparo de boletos",
    texto:
      "Régua de Cobrança passo a passo: origem, título da remessa, faixa de atraso, filtros, canais e templates, prévia das mensagens, acionar e acompanhar.",
    passos: tutorialRegua.passos.length,
  },
  {
    to: "/treinamento/tutorial-docusign" as const,
    icon: FileSignature,
    titulo: "Tutorial: envio para assinatura (DocuSign)",
    texto:
      "Do Novo disparo às assinaturas: compradores, modelo, verificação, quem assina, revisão e acompanhamento.",
    passos: tutorialDocusign.passos.length,
  },
];

export const Route = createFileRoute("/_authenticated/treinamento/")({
  component: CentroDeTreinamentoPage,
});

function CentroDeTreinamentoPage() {
  const guia = guiaDisparoEmMassa;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Centro de Treinamento">
        Guias ilustrados para aprender a usar o portal, em linguagem simples e com as telas reais do
        sistema. Escolha um guia e siga os passos na ordem.
      </PageHead>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Tutoriais ilustrados
        </h2>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {TUTORIAIS.map((t) => (
            <article
              key={t.to}
              className="flex flex-col rounded-[10px] border bg-card p-5 shadow-card"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <Selo tom="info">Novo</Selo>
              </div>
              <h3 className="mb-1 text-[15px] font-bold">{t.titulo}</h3>
              <p className="mb-3 text-[13px] leading-normal text-muted-foreground">{t.texto}</p>
              <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5" />
                  {t.passos} passos
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <MonitorPlay className="h-3.5 w-3.5" />
                  Telas ilustradas com dados fictícios
                </li>
              </ul>
              <Button asChild className="mt-auto self-start">
                <Link to={t.to}>
                  Abrir tutorial
                  <ArrowRight />
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Guia completo
        </h2>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <article className="flex flex-col rounded-[10px] border border-primary bg-card p-5 shadow-brand">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <Send className="h-5 w-5" />
              </div>
              <Selo tom="success">Disponível</Selo>
            </div>
            <h3 className="mb-1 text-[15px] font-bold">Como usar o Disparo de Cobranças e Documentos</h3>
            <p className="mb-3 text-[13px] leading-normal text-muted-foreground">
              Do primeiro acesso ao acompanhamento das assinaturas: escolher os compradores, o
              modelo do documento, quem assina, conferir e disparar.
            </p>
            <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                {guia.passos.length} passos
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Leitura de ~15 min
              </li>
              <li className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Com prints das telas
              </li>
            </ul>
            <Button asChild className="mt-auto self-start">
              <Link to="/treinamento/disparo-em-massa">
                Abrir passo a passo
                <ArrowRight />
              </Link>
            </Button>
          </article>
        </div>
      </section>
    </div>
  );
}
