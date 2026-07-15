import { createFileRoute } from "@tanstack/react-router";
import { CrmCustomerDetailPage } from "@/components/internal/crm/CrmCustomerDetailPage";

export const Route = createFileRoute("/_authenticated/_internal/workspace/crm/$id")({
  component: CrmDetail,
});

function CrmDetail() {
  const { id } = Route.useParams();
  return <CrmCustomerDetailPage userId={id} />;
}
