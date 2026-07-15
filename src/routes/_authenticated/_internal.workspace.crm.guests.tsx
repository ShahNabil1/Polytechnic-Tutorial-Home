import { createFileRoute } from "@tanstack/react-router";
import { CrmListPage } from "@/components/internal/crm/CrmListPage";

export const Route = createFileRoute("/_authenticated/_internal/workspace/crm/guests")({
  component: () => <CrmListPage kind="guests" />,
});
