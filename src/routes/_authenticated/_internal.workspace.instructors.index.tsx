import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersManagerEN } from "@/components/internal/AdminUsersManagerEN";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/instructors/")({
  component: InstructorsPage,
});

function InstructorsPage() {
  const { loading } = useRole();
  if (loading) return null;
  return <AdminUsersManagerEN role="instructor" />;
}
