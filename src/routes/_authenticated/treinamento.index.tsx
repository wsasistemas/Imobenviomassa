import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clock, ListChecks, Send } from "lucide-react";
import { PageHead, Selo } from "@/components/page";
import { Button } from "@/components/ui/button";
import { guiaDisparoEmMassa } from "@/lib/treinamento/disparo-em-massa";

export const Route = createFileRoute("/_authenticated/treinamento/")({
  component: CentroDeTreinamentoPage,
});

function CentroDeTreinamentoPage() {
  const guia = guiaDisparoEmMassa;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Centro de Treinamento">
        Guias ilustrados para aprender a usar o portal, em linguagem simples e com as telas reais do sistema. Escolha um
        guia e siga os passos na ordem.
      </PageHead>

      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Guias disponíveis</h2>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <article className="flex flex-col rounded-[10px] border border-primary bg-card p-5 shadow-brand">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <Send className="h-5 w-5" />
              </div>
              <Selo tom="success">Disponível</Selo>
            </div>
            <h3 className="mb-1 text-[15px] font-bold">Como usar o Disparo em Massa</h3>
            <p className="mb-3 text-[13px] leading-normal text-muted-foreground">
              Do primeiro acesso ao acompanhamento das assinaturas: escolher os compradores, o modelo do documento, quem
              assina, conferir e disparar.
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
