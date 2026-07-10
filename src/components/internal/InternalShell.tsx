import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  User as UserIcon,
  Users,
  GraduationCap,
  ExternalLink,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export const WORKSPACE_BASE_NAV: NavItem[] = [
  { to: "/workspace", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/workspace/profile", label: "Profile", icon: UserIcon },
];

export const WORKSPACE_ADMIN_NAV: NavItem[] = [
  { to: "/workspace/employees", label: "Employees", icon: Users },
  { to: "/workspace/instructors", label: "Instructors", icon: GraduationCap },
];

export const INSTRUCTOR_NAV: NavItem[] = [
  { to: "/instructor", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/instructor/profile", label: "Profile", icon: UserIcon },
];

type Props = {
  brand: string;
  subtitle: string;
  nav: NavItem[];
  children: ReactNode;
};

export function InternalShell({ brand, subtitle, nav, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
      setSignOutOpen(false);
      navigate({ to: "/", replace: true });
    }
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-1 px-3">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold tracking-tight transition-all",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px] shrink-0", active ? "text-slate-900" : "text-slate-400 group-hover:text-white")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const BottomActions = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="border-t border-white/10 p-3 space-y-1">
      <a
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <ExternalLink className="size-[18px] text-slate-400" />
        Go to Main Website
      </a>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          setSignOutOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors"
      >
        <LogOut className="size-[18px]" />
        Sign Out
      </button>
    </div>
  );

  const BrandBlock = () => (
    <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
        <ShieldCheck className="size-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-base font-bold tracking-tight text-white leading-tight truncate">
          {brand}
        </p>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );

  return (
    <div className="font-sans min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`.font-display{font-family:'Space Grotesk','Inter',system-ui,sans-serif;}`}</style>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-950 lg:flex">
        <BrandBlock />
        <div className="flex-1 overflow-y-auto py-4">
          <NavList />
        </div>
        <BottomActions />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-tight">{brand}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-slate-950 p-0 border-slate-800 text-slate-100">
          <SheetHeader className="sr-only">
            <SheetTitle>{brand} navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <BrandBlock />
            <div className="flex-1 overflow-y-auto py-4">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <BottomActions onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-10 lg:py-10">{children}</div>
      </main>

      {/* Sign-out confirmation */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold tracking-tight">
              Sign out of your workspace?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign back in to access your control panel. Any unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Stay signed in</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSignOut();
              }}
              disabled={signingOut}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {signingOut ? "Signing out..." : "Yes, sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
