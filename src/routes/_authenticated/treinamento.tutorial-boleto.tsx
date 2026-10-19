import { createFileRoute } from "@tanstack/react-router";
import { TutorialMockup } from "@/components/treinamento/tutorial-mockup";
import { tutorialRegua } from "@/components/treinamento/tutorial-regua";

export const Route = createFileRoute("/_authenticated/treinamento/tutorial-boleto")({
  component: () => <TutorialMockup tutorial={tutorialRegua} />,
});
