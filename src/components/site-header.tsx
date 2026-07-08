import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import { toBanglaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "হোম" },
  { to: "/shop", label: "বইসমূহ" },
  { to: "/shop?type=suggestion", label: "সুপার সাজেশন" },
  { to: "/about", label: "আমাদের সম্পর্কে" },
];

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useCart((s) => s.items);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 md:px-6 md:py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <span className="font-inter text-sm font-bold">PE</span>
          </div>
          <span className="text-lg font-semibold tracking-tight md:text-xl">
            পলিটেকনিক এডু
          </span>
        </Link>

        <nav className="hidden gap-7 text-sm font-medium md:flex">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to.split("?")[0]);
            return (
              <Link
                key={item.to}
                to={item.to.split("?")[0]}
                search={
                  item.to.includes("?type=suggestion")
                    ? { type: "suggestion" }
                    : undefined
                }
                className={cn(
                  "text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            className="relative flex items-center gap-2 rounded-full bg-secondary px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary/70"
          >
            <ShoppingCart className="size-4" />
            <span className="font-inter tabular-nums">
              {toBanglaNumber(count)}
            </span>
          </Link>
          <button
            className="grid size-10 place-items-center rounded-lg hover:bg-secondary md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to.split("?")[0]}
                search={
                  item.to.includes("?type=suggestion")
                    ? { type: "suggestion" }
                    : undefined
                }
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
