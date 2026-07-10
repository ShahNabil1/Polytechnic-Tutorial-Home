import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ProfilePage } from "@/components/account/ProfilePage";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceProfile,
});

function WorkspaceProfile() {
  const { info, loading } = useRole();
  if (loading || !info) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Workspace hosts both super_admin and employee
  const role = info.primaryRole === "super_admin" ? "super_admin" : "employee";
  return <ProfilePage role={role} />;
}
