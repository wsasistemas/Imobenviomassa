import { createFileRoute } from "@tanstack/react-router";
import { TutorialMockup } from "@/components/treinamento/tutorial-mockup";
import { tutorialDocusign } from "@/components/treinamento/tutorial-docusign";

export const Route = createFileRoute("/_authenticated/treinamento/tutorial-docusign")({
  component: () => <TutorialMockup tutorial={tutorialDocusign} />,
});
