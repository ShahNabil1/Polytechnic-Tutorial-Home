import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/instructors")({
  component: InstructorsPage,
});

function InstructorsPage() {
  const { info, loading } = useRole();
  if (loading) return null;
  if (info?.primaryRole !== "super_admin") {
    throw redirect({ to: "/workspace" });
  }
  return <AdminUsersManager role="instructor" />;
}
