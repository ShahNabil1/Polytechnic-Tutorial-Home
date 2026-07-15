import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_internal/workspace/crm/")({
  beforeLoad: () => {
    throw redirect({ to: "/workspace/crm/customers" });
  },
});
