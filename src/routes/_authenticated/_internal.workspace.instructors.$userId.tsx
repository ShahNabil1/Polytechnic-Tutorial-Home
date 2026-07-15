import { createFileRoute, redirect } from "@tanstack/react-router";
import { InternalUserDetailPage } from "@/components/internal/InternalUserDetailPage";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/instructors/$userId")({
  component: InstructorDetail,
});

function InstructorDetail() {
  const { userId } = Route.useParams();
  const { loading, has } = useRole();
  if (loading) return null;
  if (!has("manage_users")) {
    throw redirect({ to: "/workspace" });
  }
  return <InternalUserDetailPage userId={userId} role="instructor" />;
}
