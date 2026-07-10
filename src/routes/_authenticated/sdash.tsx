import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, ShoppingBag, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sdash")({
  head: () => ({
    meta: [
      { title: "স্টুডেন্ট ড্যাশবোর্ড — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDashboardLayout,
});

const TABS = [
  { to: "/sdash", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/sdash/courses", label: "আমার কোর্স", icon: BookOpen },
  { to: "/sdash/shop", label: "আমার শপ", icon: ShoppingBag },
  { to: "/sdash/profile", label: "প্রোফাইল", icon: UserIcon },
] as const;

function StudentDashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6 md:py-10">
      {/* Sidebar (desktop) / top tabs (mobile) */}
      <aside className="md:w-56 md:shrink-0">
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(tab.to + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
