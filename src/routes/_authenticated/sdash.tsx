import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, ShoppingBag, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRole, primaryHome } from "@/hooks/use-role";
import { fetchMyProfile, getMissingProfileFields, type ProfileRow } from "@/lib/profile";
import { ProfileCompletenessBanner } from "@/components/account/ProfileCompletenessBanner";

export const Route = createFileRoute("/_authenticated/sdash")({
  head: () => ({
    meta: [
      { title: "স্টুডেন্ট ড্যাশবোর্ড — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDashboardLayout,
});

const TABS: ReadonlyArray<{
  to: "/sdash" | "/sdash/courses" | "/sdash/shop" | "/sdash/profile";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/sdash", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/sdash/courses", label: "আমার কোর্স", icon: BookOpen },
  { to: "/sdash/shop", label: "আমার শপ", icon: ShoppingBag },
  { to: "/sdash/profile", label: "প্রোফাইল", icon: UserIcon },
];

function StudentDashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { info, isInternal, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (roleLoading || !info) return;
    if (isInternal) {
      navigate({ to: primaryHome(info.primaryRole), replace: true });
    }
  }, [roleLoading, info, isInternal, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyProfile(user.id).then((p) => { if (!cancelled) setProfile(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, pathname]);

  const missing = getMissingProfileFields(profile);
  const onProfilePage = pathname === "/sdash/profile";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6 md:py-10">
      <aside className="md:w-56 md:shrink-0">
        <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:flex md:flex-col md:gap-1">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(tab.to + "/");
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground md:bg-transparent",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        <ProfileCompletenessBanner missing={missing} showOnProfilePage={onProfilePage} />
        <Outlet />
      </main>
    </div>
  );
}
