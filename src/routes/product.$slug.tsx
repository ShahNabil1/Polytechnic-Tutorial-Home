import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { productTypeLabel, getProductBySlug } from "@/lib/products";
import { useCart } from "@/lib/cart-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => {
    const product = getProductBySlug(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "প্রোডাক্ট পাওয়া যায়নি — Polytechnic Tutorial Home" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: `${loaderData.product.title} — Polytechnic Tutorial Home` },
        { name: "description", content: loaderData.product.description },
        {
          property: "og:title",
          content: `${loaderData.product.title} — Polytechnic Tutorial Home`,
        },
        { property: "og:description", content: loaderData.product.description },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.some((i) => i.productId === product.id));

  const isDigital = product.type !== "physical";

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/shop"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          সব বই দেখুন
        </Link>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div
            className={cn(
              "relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br text-[10rem] shadow-xl ring-1 ring-border",
              product.coverColor,
            )}
          >
            <span className="drop-shadow-2xl">{product.coverEmoji}</span>
            <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-black/5">
              {productTypeLabel(product.type)}
            </span>
          </div>

          <div className="flex flex-col">
            {product.subtitle && (
              <p className="text-sm font-medium text-muted-foreground">
                {product.subtitle}
              </p>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {product.title}
            </h1>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums">
                {formatBDT(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through tabular-nums">
                  {formatBDT(product.originalPrice)}
                </span>
              )}
            </div>

            {product.stock !== undefined && (
              <p className="mt-2 text-sm text-brand">
                <Check className="mr-1 inline size-4" />
                স্টকে আছে ({product.stock}+ কপি)
              </p>
            )}

            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                বিবরণ
              </h3>
              <p className="text-base leading-relaxed text-foreground/90">
                {product.description}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => add(product)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-6 py-4 text-base font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <ShoppingCart className="size-5" />
                {inCart ? "কার্টে যোগ হয়েছে" : "কার্টে যোগ করুন"}
              </button>
              <Link
                to="/cart"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-4 text-base font-semibold transition-colors hover:bg-secondary"
              >
                কার্ট দেখুন
              </Link>
            </div>

            {isDigital && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">📥 ইনস্ট্যান্ট ডাউনলোড</p>
                <p className="mt-1">
                  পেমেন্ট সম্পন্ন হওয়ার পরপরই সিকিউর ডাউনলোড লিংক আপনার
                  ইমেইলে পাঠানো হবে।
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
