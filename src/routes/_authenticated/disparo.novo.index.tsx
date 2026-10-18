import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/disparo/novo/")({
  beforeLoad: () => {
    throw redirect({ to: "/disparo/novo/origem" });
  },
});
