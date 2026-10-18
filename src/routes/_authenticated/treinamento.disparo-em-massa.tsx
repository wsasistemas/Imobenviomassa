import { createFileRoute } from "@tanstack/react-router";
import { GuiaPassoAPasso } from "@/components/treinamento/guia-passo-a-passo";
import { guiaDisparoEmMassa } from "@/lib/treinamento/disparo-em-massa";

export const Route = createFileRoute("/_authenticated/treinamento/disparo-em-massa")({
  component: () => <GuiaPassoAPasso guia={guiaDisparoEmMassa} />,
});
