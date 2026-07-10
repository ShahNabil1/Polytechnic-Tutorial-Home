import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { useCartDrawer } from "@/lib/cart-drawer-store";
import { formatBDT, toBanglaNumber } from "@/lib/format";
import { productTypeLabel } from "@/lib/products";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const open = useCartDrawer((s) => s.open);
  const setOpen = useCartDrawer((s) => s.setOpen);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = cartSubtotal(items);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-lg font-extrabold">
            <ShoppingBag className="size-5" />
            আপনার কার্ট
            {items.length > 0 && (
              <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
                {toBanglaNumber(items.length)} টি
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="grid size-20 place-items-center rounded-full bg-brand-soft text-brand"
            >
              <ShoppingBag className="size-10" />
            </motion.div>
            <h3 className="mt-5 text-lg font-extrabold">কার্ট এখনো খালি</h3>
            <p className="mt-1.5 text-sm font-medium text-muted-foreground">
              শপ থেকে বই ও সাজেশন বেছে নিন।
            </p>
            <Link
              to="/shop"
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-extrabold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand/90"
            >
              শপিং শুরু করুন
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const isDigital = item.type !== "physical";
                  return (
                    <motion.div
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
                      transition={{ type: "spring", stiffness: 240, damping: 22 }}
                      className="mb-3 flex gap-3 rounded-2xl border border-border/70 bg-card p-3 last:mb-0"
                    >
                      <Link
                        to="/product/$slug"
                        params={{ slug: item.slug }}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br text-3xl shadow-sm",
                          !item.image &&
                            (item.coverColor ?? "from-slate-200 to-slate-400"),
                        )}
                      >
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{item.coverEmoji ?? "📦"}</span>
                        )}
                      </Link>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {productTypeLabel(item.type)}
                          </p>
                          <Link
                            to="/product/$slug"
                            params={{ slug: item.slug }}
                            onClick={() => setOpen(false)}
                            className="mt-0.5 line-clamp-2 text-sm font-extrabold leading-snug hover:text-brand"
                          >
                            {item.title}
                          </Link>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          {isDigital ? (
                            <span className="text-[11px] font-bold text-muted-foreground">
                              ডিজিটাল
                            </span>
                          ) : (
                            <div className="flex items-center gap-0.5 rounded-lg border border-border">
                              <button
                                onClick={() =>
                                  setQty(item.productId, item.quantity - 1)
                                }
                                className="grid size-7 place-items-center hover:bg-secondary"
                                aria-label="কমান"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-extrabold tabular-nums">
                                {toBanglaNumber(item.quantity)}
                              </span>
                              <button
                                onClick={() =>
                                  setQty(item.productId, item.quantity + 1)
                                }
                                className="grid size-7 place-items-center hover:bg-secondary"
                                aria-label="বাড়ান"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold tabular-nums">
                              {formatBDT(item.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => remove(item.productId)}
                              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label="বাদ দিন"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div className="border-t border-border/60 bg-surface/60 px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-muted-foreground">
                  সাবটোটাল
                </span>
                <span className="text-xl font-extrabold tabular-nums">
                  {formatBDT(subtotal)}
                </span>
              </div>
              <p className="mb-4 text-[11px] font-medium text-muted-foreground">
                ডেলিভারি চার্জ চেকআউটে হিসাব হবে।
              </p>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-sm font-extrabold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand/90"
              >
                চেকআউটে যান
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 flex w-full items-center justify-center rounded-xl px-6 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                শপিং চালিয়ে যান
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
