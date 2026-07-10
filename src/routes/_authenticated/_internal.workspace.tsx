import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";
import {
  InternalShell,
  WORKSPACE_BASE_NAV,
  WORKSPACE_ADMIN_NAV,
} from "@/components/internal/InternalShell";

export const Route = createFileRoute("/_authenticated/_internal/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { info } = useRole();
  const isSuperAdmin = info?.primaryRole === "super_admin";
  const nav = isSuperAdmin ? [...WORKSPACE_BASE_NAV, ...WORKSPACE_ADMIN_NAV] : WORKSPACE_BASE_NAV;
  return (
    <InternalShell
      brand="Workspace"
      subtitle={isSuperAdmin ? "Super Admin Console" : "Employee Console"}
      nav={nav}
    >
      <Outlet />
    </InternalShell>
  );
}
