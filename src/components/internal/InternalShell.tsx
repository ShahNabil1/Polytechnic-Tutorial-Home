import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  User as UserIcon,
  ExternalLink,
  LogOut,
  Menu,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  comingSoon?: boolean;
};

// Kept for backward-compat with routes that still use the flat nav
// (e.g. the instructor shell). New surfaces should use `groups`.
export const WORKSPACE_BASE_NAV: NavItem[] = [
  { to: "/workspace", label: "Home", icon: LayoutDashboard, exact: true },
];

export const INSTRUCTOR_NAV: NavItem[] = [
  { to: "/instructor", label: "Home", icon: LayoutDashboard, exact: true },
];

type Props = {
  brand: string;
  subtitle: string;
  nav?: NavItem[];
  groups?: NavGroup[];
  profileTo: "/workspace/profile" | "/instructor/profile";
  children: ReactNode;
};

const COLLAPSE_STORAGE_KEY = "internal-shell:collapsed";
const GROUPS_STORAGE_KEY = "internal-shell:open-groups";

export function InternalShell({ brand, subtitle, nav, groups, profileTo, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
      const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (savedGroups) setOpenGroups(JSON.parse(savedGroups));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  const isActive = (item: { to: string; exact?: boolean }) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to);

  // Auto-open the group that contains the active route on first mount / route change
  const activeGroupId = useMemo(() => {
    if (!groups) return null;
    for (const g of groups) {
      if (g.items.some((i) => isActive(i))) return g.id;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, pathname]);

  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

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

  const profileItem: NavItem = {
    to: profileTo,
    label: "Profile",
    icon: UserIcon,
  };

  const NavRow = ({
    item,
    isCompact,
    onNavigate,
    nested,
  }: {
    item: NavItem;
    isCompact: boolean;
    onNavigate?: () => void;
    nested?: boolean;
  }) => {
    const Icon = item.icon;
    const active = isActive(item);
    const disabled = item.disabled;

    const linkClass = cn(
      "group relative flex items-center gap-3 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200",
      isCompact ? "justify-center px-0 py-2.5" : nested ? "py-2 pl-9 pr-3" : "px-3 py-2.5",
      active
        ? "bg-white/10 text-white shadow-lg shadow-black/30 ring-1 ring-inset ring-white/15 backdrop-blur-xl"
        : disabled
        ? "text-slate-500 cursor-not-allowed"
        : "text-slate-300 hover:bg-white/5 hover:text-white",
    );

    const inner = (
      <>
        {active && !isCompact && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-fuchsia-400" />
        )}
        <Icon
          className={cn(
            "size-[17px] shrink-0",
            active
              ? "text-white"
              : disabled
              ? "text-slate-600"
              : "text-slate-400 group-hover:text-white",
          )}
        />
        <span
          className={cn(
            "whitespace-nowrap transition-[opacity,transform] duration-200",
            isCompact ? "sr-only" : "opacity-100",
          )}
        >
          {item.label}
        </span>
      </>
    );

    const el = disabled ? (
      <span className={linkClass} aria-disabled="true">
        {inner}
      </span>
    ) : (
      <Link to={item.to} onClick={onNavigate} aria-label={item.label} className={linkClass}>
        {inner}
      </Link>
    );

    if (isCompact) {
      return (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>{el}</TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return el;
  };

  const GroupBlock = ({
    group,
    isCompact,
    onNavigate,
  }: {
    group: NavGroup;
    isCompact: boolean;
    onNavigate?: () => void;
  }) => {
    const GroupIcon = group.icon;
    const hasActiveChild = group.items.some((i) => isActive(i));
    const isOpen = openGroups[group.id] ?? hasActiveChild;

    // In compact mode, show each item as an icon-only row (skip the header entirely)
    if (isCompact) {
      return (
        <div className="space-y-1">
          {group.items.length === 0 ? (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <span className="flex justify-center rounded-lg py-2.5 text-slate-500">
                  <GroupIcon className="size-[17px]" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold">
                {group.label} — Coming soon
              </TooltipContent>
            </Tooltip>
          ) : (
            group.items.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                isCompact
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpenGroups((prev) => ({ ...prev, [group.id]: !isOpen }))}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors",
            hasActiveChild ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5",
          )}
        >
          <GroupIcon className="size-[15px] shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-300",
              isOpen ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-0.5 pt-1">
              {group.items.length === 0 ? (
                <p className="py-2 pl-9 pr-3 text-[11px] font-semibold italic text-slate-500">
                  Coming soon
                </p>
              ) : (
                group.items.map((item) => (
                  <NavRow
                    key={item.to}
                    item={item}
                    isCompact={false}
                    onNavigate={onNavigate}
                    nested
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ActionRow = ({
    icon: Icon,
    label,
    onClick,
    href,
    tone = "default",
    isCompact,
    onNavigate,
  }: {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    href?: string;
    tone?: "default" | "danger";
    isCompact: boolean;
    onNavigate?: () => void;
  }) => {
    const base = cn(
      "flex w-full items-center gap-3 rounded-lg text-sm font-semibold transition-colors duration-200",
      isCompact ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
      tone === "danger"
        ? "text-red-300 hover:bg-red-500/10 hover:text-red-200"
        : "text-slate-300 hover:bg-white/5 hover:text-white",
    );
    const inner = (
      <>
        <Icon
          className={cn(
            "size-[18px] shrink-0",
            tone === "danger" ? "" : "text-slate-400",
          )}
        />
        <span
          className={cn(
            "whitespace-nowrap transition-opacity duration-200",
            isCompact ? "sr-only" : "opacity-100",
          )}
        >
          {label}
        </span>
      </>
    );
    const el = href ? (
      <a href={href} onClick={onNavigate} className={base} aria-label={label}>
        {inner}
      </a>
    ) : (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onClick?.();
        }}
        className={base}
        aria-label={label}
      >
        {inner}
      </button>
    );
    if (isCompact) {
      return (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>{el}</TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return el;
  };

  const SidebarInner = ({
    isCompact,
    onNavigate,
    showCollapseToggle,
  }: {
    isCompact: boolean;
    onNavigate?: () => void;
    showCollapseToggle: boolean;
  }) => (
    <TooltipProvider>
      <div className="relative flex h-full flex-col">
        {/* Ambient glow layer for premium dark feel */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute top-1/3 -right-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        {/* Brand + collapse toggle */}
        <div
          className={cn(
            "relative flex items-center border-b border-white/10 transition-all duration-300",
            isCompact ? "flex-col gap-2 px-2 py-4" : "gap-3 px-4 py-5",
          )}
        >
          <div
            className={cn(
              "grid place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30 transition-all duration-300",
              isCompact ? "size-9" : "size-10",
            )}
          >
            <ShieldCheck className={cn("text-white", isCompact ? "size-4" : "size-5")} />
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 overflow-hidden transition-all duration-300",
              isCompact ? "hidden" : "block",
            )}
          >
            <p className="font-display text-base font-bold leading-tight tracking-tight text-white truncate">
              {brand}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 truncate">
              {subtitle}
            </p>
          </div>
          {showCollapseToggle && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="grid size-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "relative flex-1 space-y-2 overflow-y-auto py-4 transition-all duration-300",
            isCompact ? "px-2" : "px-3",
          )}
        >
          {groups
            ? groups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  isCompact={isCompact}
                  onNavigate={onNavigate}
                />
              ))
            : nav?.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  isCompact={isCompact}
                  onNavigate={onNavigate}
                />
              ))}
        </nav>

        {/* Bottom stack: Profile → Main Website → Sign out */}
        <div
          className={cn(
            "relative space-y-1 border-t border-white/10 py-3 transition-all duration-300",
            isCompact ? "px-2" : "px-3",
          )}
        >
          <NavRow item={profileItem} isCompact={isCompact} onNavigate={onNavigate} />
          <ActionRow
            icon={ExternalLink}
            label="Go to Main Website"
            href="/"
            isCompact={isCompact}
            onNavigate={onNavigate}
          />
          <ActionRow
            icon={LogOut}
            label="Sign Out"
            tone="danger"
            isCompact={isCompact}
            onNavigate={onNavigate}
            onClick={() => setSignOutOpen(true)}
          />
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <div
      className="font-sans min-h-screen bg-slate-50 text-slate-900"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <style>{`.font-display{font-family:'Space Grotesk','Inter',system-ui,sans-serif;}`}</style>

      {/* Desktop sidebar — smooth width transition */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden bg-slate-950 shadow-2xl shadow-black/40 lg:flex",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="flex h-full w-full flex-col">
          <SidebarInner isCompact={collapsed} showCollapseToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <span className="font-display font-bold tracking-tight">{brand}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-slate-800 bg-slate-950 p-0 text-slate-100"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{brand} navigation</SheetTitle>
          </SheetHeader>
          <SidebarInner
            isCompact={false}
            onNavigate={() => setMobileOpen(false)}
            showCollapseToggle={false}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main
        className={cn(
          "transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "lg:pl-[72px]" : "lg:pl-64",
        )}
      >
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
              You will need to sign back in to access your control panel. Any unsaved
              changes will be lost.
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
