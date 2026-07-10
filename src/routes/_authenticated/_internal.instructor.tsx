import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_internal/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InstructorLayout,
});

const TABS = [
  { to: "/instructor", label: "হোম", icon: LayoutDashboard, exact: true },
  { to: "/instructor/profile", label: "প্রোফাইল", icon: UserIcon },
] as const;

function InstructorLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Instructor</h1>
        <p className="text-sm text-muted-foreground">ইন্সট্রাক্টর ড্যাশবোর্ড</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 border-b">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
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
