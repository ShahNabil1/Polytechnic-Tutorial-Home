import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Product } from "@/lib/products";
import { PRODUCT_TYPE_LABEL } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<Product["type"], string> = {
  physical: "bg-brand-soft text-brand",
  ebook: "bg-sky-100 text-sky-700",
  suggestion: "bg-amber-100 text-amber-800",
};

export function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className="group flex flex-col"
    >
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative mb-4 block overflow-hidden rounded-xl bg-card ring-1 ring-border/60 shadow-sm transition-all group-hover:shadow-md"
      >
        <div
          className={cn(
            "flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br text-6xl transition-transform duration-500 group-hover:scale-[1.03]",
            product.coverColor,
          )}
          aria-hidden
        >
          <span className="drop-shadow-lg">{product.coverEmoji}</span>
        </div>
        <span
          className={cn(
            "absolute right-3 top-3 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-black/5",
            TYPE_BADGE[product.type],
          )}
        >
          {PRODUCT_TYPE_LABEL[product.type]}
        </span>
      </Link>
      <div className="flex flex-1 flex-col">
        {product.subtitle && (
          <p className="text-xs font-medium text-muted-foreground">
            {product.subtitle}
          </p>
        )}
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="mt-1 text-base font-semibold leading-snug transition-colors hover:text-brand"
        >
          {product.title}
        </Link>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-bold tabular-nums">
              {formatBDT(product.price)}
            </p>
            {product.originalPrice && (
              <p className="text-xs text-muted-foreground line-through tabular-nums">
                {formatBDT(product.originalPrice)}
              </p>
            )}
          </div>
          <button
            onClick={() => add(product)}
            className="grid size-10 place-items-center rounded-lg bg-foreground text-background transition-colors hover:bg-brand"
            aria-label="কার্টে যোগ করুন"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
