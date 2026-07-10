import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ImageIcon, ShoppingCart, Zap } from "lucide-react";
import type { Product } from "@/lib/products";
import { productTypeLabel } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { useCartDrawer } from "@/lib/cart-drawer-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<Product["type"], string> = {
  physical: "bg-brand-soft text-brand",
  ebook: "bg-sky-100 text-sky-700",
  suggestion: "bg-amber-100 text-amber-800",
};

export function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) =>
    s.items.some((i) => i.productId === product.id),
  );
  const openDrawer = useCartDrawer((s) => s.openDrawer);
  const navigate = useNavigate();
  const cover = product.ogImage || product.images?.[0]?.url;

  const handleAddToCart = () => {
    add(product);
    openDrawer();
  };

  const handleBuyNow = () => {
    if (!inCart) add(product);
    navigate({ to: "/checkout" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -6 }}
      className="group flex flex-col"
    >
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="relative mb-4 block overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 shadow-sm transition-all duration-300 group-hover:shadow-xl group-hover:ring-brand/30"
      >
        {cover ? (
          <img
            src={cover}
            alt={product.title}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <div
            className={cn(
              "flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br text-6xl transition-transform duration-700 group-hover:scale-[1.06]",
              product.coverColor ?? "from-slate-200 to-slate-400",
            )}
            aria-hidden
          >
            <span className="drop-shadow-lg">
              {product.coverEmoji ?? <ImageIcon className="size-10 text-white/80" />}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span
          className={cn(
            "absolute right-3 top-3 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ring-1 ring-black/5",
            TYPE_BADGE[product.type] ?? "bg-slate-100 text-slate-700",
          )}
        >
          {productTypeLabel(product.type)}
        </span>
      </Link>
      <div className="flex flex-1 flex-col">
        {product.subtitle && (
          <p className="text-xs font-bold text-muted-foreground">
            {product.subtitle}
          </p>
        )}
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="mt-1 line-clamp-2 text-base font-extrabold leading-snug transition-colors hover:text-brand"
        >
          {product.title}
        </Link>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-lg font-extrabold tabular-nums">
            {formatBDT(product.price)}
          </p>
          {product.originalPrice && (
            <p className="text-xs font-bold text-muted-foreground line-through tabular-nums">
              {formatBDT(product.originalPrice)}
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-foreground/90 bg-background px-3 py-2.5 text-xs font-extrabold tracking-wide text-foreground transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-background active:translate-y-0"
          >
            <ShoppingCart className="size-4" />
            {inCart ? "Added" : "Add To Cart"}
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand via-brand to-brand/80 px-3 py-2.5 text-xs font-extrabold tracking-wide text-brand-foreground shadow-md shadow-brand/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/40 active:translate-y-0"
          >
            <Zap className="size-4 fill-current" />
            Buy Now
          </button>
        </div>
      </div>
    </motion.div>
  );
}
