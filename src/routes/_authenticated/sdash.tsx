import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  ShoppingBag,
  User as UserIcon,
  Loader2,
  Compass,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRole, primaryHome } from "@/hooks/use-role";
import { fetchMyProfile, getMissingProfileFields, type ProfileRow } from "@/lib/profile";
import { ProfileCompletenessBanner } from "@/components/account/ProfileCompletenessBanner";
import { CartDrawer } from "@/components/cart-drawer";
import { useCartDrawer } from "@/lib/cart-drawer-store";
import { useCart } from "@/lib/cart-store";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/pth-logo.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/sdash")({
  head: () => ({
    meta: [
      { title: "স্টুডেন্ট ড্যাশবোর্ড — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDashboardLayout,
});

type TabItem = {
  to: "/sdash" | "/sdash/courses" | "/sdash/shop" | "/sdash/profile";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  desc?: string;
};

const NAV_PRIMARY: ReadonlyArray<TabItem> = [
  { to: "/sdash", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true, desc: "সারাংশ ও শর্টকাট" },
  { to: "/sdash/courses", label: "কোর্স", icon: BookOpen, desc: "কোর্স ব্রাউজ ও আমার কোর্স" },
  { to: "/sdash/shop", label: "শপ", icon: ShoppingBag, desc: "বই, ই-বুক ও সাজেশন" },
];

const NAV_ACCOUNT: ReadonlyArray<TabItem> = [
  { to: "/sdash/profile", label: "প্রোফাইল", icon: UserIcon, desc: "একাউন্ট সেটিংস" },
];

function StudentDashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { info, isInternal, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const openCart = useCartDrawer((s) => s.openDrawer);
  const cartCount = useCart((s) => s.items.reduce((a, i) => a + i.quantity, 0));

  // Hydrate collapse preference after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sdash:collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("sdash:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

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

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  const missing = getMissingProfileFields(profile);
  const onProfilePage = pathname === "/sdash/profile";

  const displayName = useMemo(() => {
    const m = user?.user_metadata as { full_name?: string } | undefined;
    return (
      profile?.full_name ||
      m?.full_name ||
      user?.email ||
      user?.phone ||
      "শিক্ষার্থী"
    );
  }, [profile, user]);

  const initials = useMemo(() => {
    const s = (displayName || "S").trim();
    const parts = s.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "S";
  }, [displayName]);

  const avatarUrl = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as {
      avatar_url?: string;
      picture?: string;
    };
    return (
      (profile as unknown as { avatar_url?: string | null })?.avatar_url ||
      meta.avatar_url ||
      meta.picture ||
      null
    );
  }, [profile, user]);

  const pageTitle = useMemo(() => {
    if (pathname === "/sdash") return "ড্যাশবোর্ড";
    if (pathname.startsWith("/sdash/courses")) return "কোর্স";
    if (pathname.startsWith("/sdash/shop")) return "শপ";
    if (pathname.startsWith("/sdash/profile")) return "প্রোফাইল";
    return "ড্যাশবোর্ড";
  }, [pathname]);

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate({ to: "/", replace: true });
    }
  }

  if (roleLoading || !info || isInternal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          <Menu className="size-5" />
        </button>
        <Link to="/sdash" className="flex items-center gap-2 min-w-0">
          <img src={logoAsset.url} alt="" className="size-7 rounded-md shrink-0" />
          <span className="truncate text-sm font-semibold tracking-tight">Polytechnic Tutorial Home</span>
        </Link>
        <button
          onClick={openCart}
          aria-label="Open cart"
          className="relative grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          <ShoppingCart className="size-5" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground text-center leading-4">
              {cartCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        {!collapsed && (
          <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white">
            <SidebarContent
              displayName={displayName}
              initials={initials}
              avatarUrl={avatarUrl}
              email={user?.email ?? user?.phone ?? ""}
              pathname={pathname}
              onSignOut={handleSignOut}
              onCollapse={() => setCollapsed(true)}
            />
          </aside>
        )}

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <button
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Close menu overlay"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <span className="text-sm font-semibold">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="grid size-8 place-items-center rounded-md hover:bg-slate-100"
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarContent
                displayName={displayName}
                initials={initials}
                avatarUrl={avatarUrl}
                email={user?.email ?? user?.phone ?? ""}
                pathname={pathname}
                onSignOut={handleSignOut}
              />
            </aside>
          </div>
        )}

        {/* Main */}
        <div className={cn("flex-1 min-w-0", !collapsed && "lg:pl-64")}>
          {/* Desktop top bar */}
          <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-6 py-4 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "সাইডবার খুলুন" : "সাইডবার বন্ধ করুন"}
                title={collapsed ? "সাইডবার খুলুন" : "সাইডবার বন্ধ করুন"}
                className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shrink-0"
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  শিক্ষার্থী পোর্টাল
                </div>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 truncate">
                  {pageTitle}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Home className="size-4" />
                <span>মেইন সাইট</span>
              </Link>
              <button
                onClick={openCart}
                className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <ShoppingCart className="size-4" />
                <span>কার্ট</span>
                {cartCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground leading-5">
                    {cartCount}
                  </span>
                )}
              </button>
              <Link
                to="/sdash/profile"
                className="ml-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50 transition-colors"
              >
                <AvatarBadge url={avatarUrl} initials={initials} size={28} />
                <div className="pr-1 text-sm font-medium text-slate-800 max-w-[160px] truncate">
                  {displayName}
                </div>
              </Link>
            </div>
          </header>

          <main className="px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-7xl">
              <ProfileCompletenessBanner missing={missing} showOnProfilePage={onProfilePage} />
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Cart drawer needs to be mounted since we removed SiteHeader on sdash */}
      <CartDrawer />
    </div>
  );
}

function SidebarContent({
  displayName,
  initials,
  avatarUrl,
  email,
  pathname,
  onSignOut,
  onCollapse,
}: {
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  email: string;
  pathname: string;
  onSignOut: () => void;
  onCollapse?: () => void;
}) {
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200">
        <Link to="/sdash" className="flex items-center gap-2.5 min-w-0 flex-1">
          <img src={logoAsset.url} alt="" className="size-9 rounded-lg shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-slate-900 truncate">
              Polytechnic Tutorial
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Student Portal
            </div>
          </div>
        </Link>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="সাইডবার বন্ধ করুন"
            title="সাইডবার বন্ধ করুন"
            className="hidden lg:grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Learn
          </div>
          <ul className="space-y-0.5">
            {NAV_PRIMARY.map((item) => {
              const active = isActive(item.to, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-slate-500")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Account
          </div>
          <ul className="space-y-0.5">
            {NAV_ACCOUNT.map((item) => {
              const active = isActive(item.to, item.exact);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-slate-500")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Explore
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                to="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Compass className="size-4 shrink-0 text-slate-500" />
                <span>মেইন ওয়েবসাইট</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="border-t border-slate-200 p-3 space-y-2">
        <Link
          to="/sdash/profile"
          className="flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-100"
        >
          <AvatarBadge url={avatarUrl} initials={initials} size={36} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{displayName}</div>
            <div className="text-xs text-slate-500 truncate">{email || "শিক্ষার্থী"}</div>
          </div>
        </Link>
        <button
          onClick={onSignOut}
          className="w-full inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-4" />
          সাইন আউট
        </button>
      </div>
    </>
  );
}

function AvatarBadge({
  url,
  initials,
  size,
}: {
  url: string | null;
  initials: string;
  size: number;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className="rounded-full object-cover shrink-0 ring-1 ring-slate-200"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      style={style}
      className="grid place-items-center rounded-full bg-gradient-to-br from-brand to-emerald-700 text-white text-xs font-semibold shrink-0 ring-1 ring-black/5"
    >
      {initials}
    </div>
  );
}
