import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import logoAsset from "@/assets/pth-logo.jpg.asset.json";
import { ShoppingCart, Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { toBanglaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { AuthDrawer } from "@/components/auth-drawer";
import { CartDrawer } from "@/components/cart-drawer";
import { useCartDrawer } from "@/lib/cart-drawer-store";
import { signOutSafely } from "@/lib/auth-reliability";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = { to: string; label: string; hash?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "হোম" },
  { to: "/#courses", label: "কোর্স", hash: true },
  
  { to: "/#testimonials", label: "রিভিউ", hash: true },
  { to: "/#faq", label: "FAQ", hash: true },
  { to: "/shop", label: "শপ" },
  { to: "/about", label: "আমাদের সম্পর্কে" },
];

function NavAnchor({
  item,
  active,
  className,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  className: string;
  onClick?: () => void;
}) {
  if (item.hash) {
    return (
      <a
        href={item.to}
        onClick={onClick}
        className={cn(className, active && "text-foreground")}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(className, active && "text-foreground")}
    >
      {item.label}
    </Link>
  );
}

function AuthButton() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Global "please open sign-in" event so public pages (e.g. course enroll)
  // can request the shared auth drawer without prop drilling.
  useEffect(() => {
    const handler = () => setDrawerOpen(true);
    window.addEventListener("open-auth-drawer", handler);
    return () => window.removeEventListener("open-auth-drawer", handler);
  }, []);
  if (loading) return null;
  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/90 sm:px-3 sm:text-sm"
        >
          <UserIcon className="size-4" />
          সাইন ইন
        </button>
        <AuthDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/sdash"
        className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/90 sm:px-3 sm:text-sm"
      >
        <UserIcon className="size-4" />
        <span className="hidden xs:inline sm:inline">ড্যাশবোর্ড</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await signOutSafely();
          toast.success("সাইন আউট হয়েছে");
          navigate({ to: "/", replace: true });
        }}
        className="hidden items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary sm:inline-flex"
        title={user.email ?? user.phone ?? ""}
      >
        <LogOut className="size-4" />
        সাইন আউট
      </button>
    </div>
  );
}


export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useCart((s) => s.items);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const openCart = useCartDrawer((s) => s.openDrawer);
  const queryClient = useQueryClient();




  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 md:px-6 md:py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logoAsset.url}
            alt="Polytechnic Tutorial Home"
            className="size-10 rounded-full ring-1 ring-border"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight md:text-base">
              Polytechnic Tutorial Home
            </span>
            <span className="hidden text-[11px] text-muted-foreground md:block">
              Knowledge · Wisdom · Humanity — Bogura
            </span>
          </div>
        </Link>

        <nav className="hidden gap-6 text-sm md:flex">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname === item.to;
            return (
              <NavAnchor
                key={item.to}
                item={item}
                active={active}
                className="text-muted-foreground transition-colors hover:text-foreground"
              />
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <AuthButton />
          <button
            type="button"
            onClick={openCart}
            className="relative flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-bold transition-colors hover:bg-secondary"
            aria-label="কার্ট দেখুন"
          >
            <ShoppingCart className="size-4" />
            <span className="font-inter tabular-nums text-xs">
              {toBanglaNumber(count)}
            </span>
          </button>
          <button
            className="grid size-9 place-items-center rounded-md hover:bg-secondary md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {NAV.map((item) => (
              <NavAnchor
                key={item.to}
                item={item}
                active={false}
                onClick={() => setOpen(false)}
                className="py-3 text-sm text-muted-foreground hover:text-foreground"
              />
            ))}
            {user && (
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  await signOutSafely();
                  toast.success("সাইন আউট হয়েছে");
                  navigate({ to: "/", replace: true });
                }}
                className="flex items-center gap-2 border-t border-border/60 py-3 text-left text-sm text-destructive"
              >
                <LogOut className="size-4" />
                সাইন আউট
              </button>
            )}
          </nav>
        </div>
      )}

      <CartDrawer />
    </header>
  );
}
