import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminUsersManagerEN } from "@/components/internal/AdminUsersManagerEN";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/employees/")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { loading, has } = useRole();
  if (loading) return null;
  if (!has("manage_users")) {
    throw redirect({ to: "/workspace" });
  }
  return <AdminUsersManagerEN role="employee" />;
}
