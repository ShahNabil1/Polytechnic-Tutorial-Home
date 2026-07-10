import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, User as UserIcon, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspaceLayout,
});

const BASE_TABS = [
  { to: "/workspace", label: "হোম", icon: LayoutDashboard, exact: true },
  { to: "/workspace/profile", label: "প্রোফাইল", icon: UserIcon },
] as const;

const ADMIN_TABS = [
  { to: "/workspace/employees", label: "এমপ্লয়ি", icon: Users },
  { to: "/workspace/instructors", label: "ইন্সট্রাক্টর", icon: GraduationCap },
] as const;

function WorkspaceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { info } = useRole();
  const isSuperAdmin = info?.primaryRole === "super_admin";
  const tabs = isSuperAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Workspace</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? "সুপার অ্যাডমিন কন্ট্রোল প্যানেল" : "এমপ্লয়ি ড্যাশবোর্ড"}
          </p>
        </div>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 border-b">
        {tabs.map((t) => {
          const active =
            "exact" in t && t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
