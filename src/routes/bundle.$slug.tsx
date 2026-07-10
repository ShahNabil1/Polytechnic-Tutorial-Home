import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Package, ShoppingCart, Zap, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { getPublicBundleBySlug } from "@/lib/bundles.functions";
import { useCart } from "@/lib/cart-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const SITE_URL = "https://polytechnictutorial.com";

export const Route = createFileRoute("/bundle/$slug")({
  loader: async ({ params }) => {
    const bundle = await getPublicBundleBySlug({ data: { slug: params.slug } });
    if (!bundle) throw notFound();
    return { bundle };
  },

  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Bundle not found — Polytechnic Tutorial Home" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const b = loaderData.bundle;
    const url = `${SITE_URL}/bundle/${params.slug}`;
    const title = b.metaTitle || `${b.title} — Special Bundle | Polytechnic Tutorial Home`;
    const fallbackDesc =
      b.description?.slice(0, 260) ||
      `Save on the "${b.title}" bundle — ${b.items.length} products together at ${formatBDT(b.price)}.`;
    const description = b.metaDescription || fallbackDesc;
    const image = b.ogImage || b.images?.[0]?.url || b.items.find((i) => i.image)?.image || null;
    const availability =
      b.items.length > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: b.title,
      description: b.description || fallbackDesc,
      sku: b.sku,
      mpn: b.sku,
      url,
      category: "Bundle",
      brand: { "@type": "Brand", name: "Polytechnic Tutorial Home" },
      offers: {
        "@type": "Offer",
        priceCurrency: "BDT",
        price: b.price,
        availability,
        url,
        ...(b.originalPrice && b.originalPrice > b.price
          ? { priceSpecification: { "@type": "UnitPriceSpecification", price: b.price, priceCurrency: "BDT" } }
          : {}),
      },
      isRelatedTo: b.items.map((it) => ({
        "@type": "Product",
        name: it.title,
        sku: it.productId,
        url: `${SITE_URL}/product/${it.slug}`,
      })),
    };
    if (image) (jsonLd as any).image = [image, ...b.images.map((i) => i.url).filter((u) => u !== image)];

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { property: "product:price:amount", content: String(b.price) },
      { property: "product:price:currency", content: "BDT" },
      { property: "product:retailer_item_id", content: b.sku },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  component: BundlePage,
});

function BundlePage() {
  const { bundle } = Route.useLoaderData();
  const navigate = useNavigate();
  const addBundle = useCart((s) => s.addBundle);
  const inCart = useCart((s) => s.items.some((i) => i.productId === `bundle:${bundle.id}`));
  const [idx, setIdx] = useState(0);

  const images = bundle.images ?? [];
  const cover = images[Math.min(idx, images.length - 1)] || null;
  const savings =
    bundle.originalPrice && bundle.originalPrice > bundle.price
      ? bundle.originalPrice - bundle.price
      : 0;

  const addToCart = () =>
    addBundle({
      id: bundle.id,
      slug: bundle.slug,
      title: bundle.title,
      price: bundle.price,
      image: bundle.ogImage || images[0]?.url || null,
      hasPhysical: bundle.hasPhysical,
    });

  const handleBuyNow = () => {
    if (!inCart) addToCart();
    navigate({ to: "/checkout" });
  };

  return (
    <div className="px-4 pb-24 pt-6 md:px-6 md:pb-14 md:pt-10">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/shop"
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground md:mb-6"
        >
          <ArrowLeft className="size-4" />
          সব বই দেখুন
        </Link>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
          <div className="mx-auto w-full max-w-[260px] sm:max-w-sm lg:max-w-none">
            <div className="relative overflow-hidden rounded-2xl bg-slate-100 shadow-xl ring-1 ring-border lg:rounded-3xl">
              <div className="relative aspect-[3/4] w-full">
                {cover ? (
                  <img src={cover.url} alt={bundle.title} className="h-full w-full object-cover" />
                ) : (
                  <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand/40")}>
                    <Package className="size-20 text-brand" />
                  </div>
                )}
                <span className="absolute right-3 top-3 rounded-full bg-brand px-2.5 py-1 text-[11px] font-extrabold text-brand-foreground shadow md:right-4 md:top-4 md:px-3 md:py-1.5 md:text-xs">
                  BUNDLE • {bundle.items.length} items
                </span>
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/5 hover:bg-white md:left-3 md:size-10"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={() => setIdx((i) => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-black/5 hover:bg-white md:right-3 md:size-10"
                      aria-label="Next"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            {bundle.subtitle && (
              <p className="text-xs font-bold text-brand md:text-sm">{bundle.subtitle}</p>
            )}
            <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl md:mt-2 md:text-3xl lg:text-[2rem] lg:leading-tight">
              {bundle.title}
            </h1>
            <p className="mt-2 text-xs font-mono text-muted-foreground">SKU: {bundle.sku}</p>

            <div className="mt-3 flex items-baseline gap-2.5 md:mt-4">
              <span className="text-xl font-extrabold tabular-nums md:text-2xl lg:text-[1.75rem]">
                {formatBDT(bundle.price)}
              </span>
              {bundle.originalPrice && bundle.originalPrice > bundle.price && (
                <span className="text-sm font-semibold text-muted-foreground line-through tabular-nums md:text-base">
                  {formatBDT(bundle.originalPrice)}
                </span>
              )}
            </div>

            {savings > 0 && (
              <p className="mt-1.5 text-xs font-bold text-emerald-700 md:text-sm">
                <Check className="mr-1 inline size-3.5 md:size-4" />
                এই বান্ডেলে সাশ্রয় {formatBDT(savings)}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5 md:mt-7 md:gap-3">
              <button
                onClick={addToCart}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-foreground/90 bg-background px-3 py-2.5 text-[13px] font-extrabold tracking-wide text-foreground transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-background md:rounded-2xl md:px-6 md:py-3.5 md:text-sm"
              >
                <ShoppingCart className="size-4" />
                {inCart ? "Added To Cart" : "Add Bundle"}
              </button>
              <button
                onClick={handleBuyNow}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand via-brand to-brand/80 px-3 py-2.5 text-[13px] font-extrabold tracking-wide text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 md:rounded-2xl md:px-6 md:py-3.5 md:text-sm"
              >
                <Zap className="size-4 fill-current" />
                Buy Now
              </button>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:text-xs">
                বান্ডেল বিবরণ
              </h3>
              <p className="whitespace-pre-line text-[13.5px] font-medium leading-relaxed text-foreground/90 md:text-sm lg:text-[15px]">
                {bundle.description || `এই স্পেশাল বান্ডেলে ${bundle.items.length} টি প্রোডাক্ট একসাথে অফার প্রাইসে পাচ্ছেন।`}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-12 md:mt-16">
          <h2 className="mb-4 text-lg font-extrabold md:text-xl">এই বান্ডেলে যা যা আছে</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.items.map((it) => (
              <Link
                key={it.productId}
                to="/product/$slug"
                params={{ slug: it.slug }}
                className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {it.image ? (
                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-extrabold">{it.title}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {formatBDT(it.price)} × {it.quantity}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
