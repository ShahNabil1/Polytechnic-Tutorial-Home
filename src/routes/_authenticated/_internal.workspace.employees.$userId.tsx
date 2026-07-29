import { createFileRoute } from "@tanstack/react-router";
import { InternalUserDetailPage } from "@/components/internal/InternalUserDetailPage";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/employees/$userId")({
  component: EmployeeDetail,
});

function EmployeeDetail() {
  const { userId } = Route.useParams();
  const { loading } = useRole();
  if (loading) return null;
  return <InternalUserDetailPage userId={userId} role="employee" />;
}
