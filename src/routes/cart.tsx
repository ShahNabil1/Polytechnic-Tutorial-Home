import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { formatBDT, toBanglaNumber } from "@/lib/format";
import { PRODUCT_TYPE_LABEL } from "@/lib/products";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "কার্ট — পলিটেকনিক এডু" },
      { name: "description", content: "আপনার নির্বাচিত বই ও সাজেশন দেখুন।" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = cartSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="px-4 py-20 md:px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 grid size-20 place-items-center rounded-full bg-brand-soft text-brand">
            <ShoppingBag className="size-10" />
          </div>
          <h1 className="text-2xl font-bold">কার্ট এখনো খালি</h1>
          <p className="mt-2 text-muted-foreground">
            শুরু করতে আমাদের শপ থেকে আপনার প্রয়োজনীয় বই বেছে নিন।
          </p>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          >
            শপিং শুরু করুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          আপনার কার্ট
        </h1>
        <p className="mt-1 text-muted-foreground">
          {toBanglaNumber(items.length)} টি প্রোডাক্ট
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {items.map((item) => {
              const isDigital = item.type !== "physical";
              return (
                <div
                  key={item.productId}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <Link
                    to="/product/$slug"
                    params={{ slug: item.slug }}
                    className={cn(
                      "grid size-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-4xl shadow-sm",
                      item.coverColor,
                    )}
                  >
                    <span>{item.coverEmoji}</span>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {PRODUCT_TYPE_LABEL[item.type]}
                      </p>
                      <Link
                        to="/product/$slug"
                        params={{ slug: item.slug }}
                        className="mt-0.5 line-clamp-2 text-base font-semibold hover:text-brand"
                      >
                        {item.title}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between">
                      {isDigital ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          ডিজিটাল প্রোডাক্ট
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 rounded-lg border border-border">
                          <button
                            onClick={() =>
                              setQty(item.productId, item.quantity - 1)
                            }
                            className="grid size-8 place-items-center hover:bg-secondary"
                            aria-label="কমান"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center font-inter text-sm font-semibold tabular-nums">
                            {toBanglaNumber(item.quantity)}
                          </span>
                          <button
                            onClick={() =>
                              setQty(item.productId, item.quantity + 1)
                            }
                            className="grid size-8 place-items-center hover:bg-secondary"
                            aria-label="বাড়ান"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold tabular-nums">
                          {formatBDT(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => remove(item.productId)}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="বাদ দিন"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold">অর্ডার সামারি</h2>
            <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">সাবটোটাল</span>
                <span className="font-semibold tabular-nums">
                  {formatBDT(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  ডেলিভারি চার্জ
                </span>
                <span className="text-xs text-muted-foreground">
                  চেকআউটে হিসাব হবে
                </span>
              </div>
            </div>
            <div className="mt-5 flex justify-between border-t border-dashed border-border pt-5">
              <span className="text-base font-semibold">আনুমানিক মোট</span>
              <span className="text-xl font-bold tabular-nums">
                {formatBDT(subtotal)}
              </span>
            </div>
            <Link
              to="/checkout"
              className="mt-6 flex items-center justify-center rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand/90"
            >
              চেকআউটে যান
            </Link>
            <Link
              to="/shop"
              className="mt-2 flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              আরো শপিং করুন
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
