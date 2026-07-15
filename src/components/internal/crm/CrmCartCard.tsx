import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShoppingCart } from "lucide-react";
import { getCrmUserCart, type CrmUserCart } from "@/lib/crm-cart.functions";

function fmtBDT(n: number) {
  return `৳${Math.round(n).toLocaleString("en-BD")}`;
}
function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function CrmCartCard({ userId }: { userId: string }) {
  const getFn = useServerFn(getCrmUserCart);
  const [cart, setCart] = useState<CrmUserCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getFn({ data: { user_id: userId } })
      .then((c) => !cancel && setCart(c as CrmUserCart | null))
      .catch(() => !cancel && setCart(null))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [userId, getFn]);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <ShoppingCart className="size-4 text-primary" />
        <h3 className="font-semibold">Current cart</h3>
        {cart?.updated_at && (
          <span className="ml-auto text-xs text-muted-foreground">Updated {fmtWhen(cart.updated_at)}</span>
        )}
      </header>
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading cart…
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Cart is empty.</div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {cart.items.map((i) => (
              <li key={i.productId} className="flex items-center gap-3 px-5 py-3">
                {i.image ? (
                  <img src={i.image} alt="" className="size-10 rounded object-cover" />
                ) : (
                  <div className="size-10 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtBDT(i.price)} × {i.quantity}
                    {i.isBundle && <span className="ml-2 rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-700">bundle</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{fmtBDT(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <footer className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs uppercase text-muted-foreground">{cart.item_count} items</span>
            <span className="text-base font-bold tabular-nums">{fmtBDT(cart.subtotal_bdt)}</span>
          </footer>
        </>
      )}
    </section>
  );
}
