import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, ShoppingCart, Zap, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { productTypeLabel } from "@/lib/products";
import { getPublicProductBySlug } from "@/lib/products.functions";
import { useCart } from "@/lib/cart-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const WHATSAPP_NUMBER = "8801790736863";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="currentColor">
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.834 2.7.834.5 0 1.905-.36 2.294-.945.15-.225.223-.484.223-.75 0-.223-.087-.32-.243-.42-.32-.194-.635-.36-.945-.522-.31-.16-.62-.31-.945-.42a1.05 1.05 0 0 0-.348-.1zM16.14 3.435c-6.94 0-12.54 5.6-12.54 12.54 0 2.383.68 4.7 1.94 6.7L3.36 28.58l6.14-1.99a12.5 12.5 0 0 0 6.64 1.94c6.94 0 12.54-5.6 12.54-12.54s-5.6-12.55-12.54-12.55zm0 22.94a10.39 10.39 0 0 1-5.53-1.6l-.4-.24-4.13 1.34 1.34-4.13-.24-.4a10.4 10.4 0 1 1 8.96 5.04z" />
    </svg>
  );
}

const SITE_URL = "https://polytechnictutorial.com";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const product = await getPublicProductBySlug({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return { product };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "প্রোডাক্ট পাওয়া যায়নি — Polytechnic Tutorial Home" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const p = loaderData.product;
    const url = `${SITE_URL}/product/${params.slug}`;
    const title = p.metaTitle || `${p.title} — Polytechnic Tutorial Home`;
    const description = p.metaDescription || p.description.slice(0, 300);
    const image = p.ogImage || p.images?.[0]?.url;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.title,
      description: p.description,
      sku: p.id,
      url,
      category: productTypeLabel(p.type),
      brand: { "@type": "Brand", name: "Polytechnic Tutorial Home" },
      offers: {
        "@type": "Offer",
        priceCurrency: "BDT",
        price: p.price,
        availability:
          p.stock === 0
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        url,
      },
    };
    if (image) (jsonLd as any).image = p.images.map((i) => i.url);

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { property: "product:price:amount", content: String(p.price) },
      { property: "product:price:currency", content: "BDT" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    ];
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(jsonLd) },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.some((i) => i.productId === product.id));
  const [idx, setIdx] = useState(0);

  const isDigital = product.type !== "physical";
  const images = product.images ?? [];
  const hasImages = images.length > 0;
  const current = hasImages ? images[Math.min(idx, images.length - 1)] : null;

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
          <div>
            <div className="relative overflow-hidden rounded-3xl bg-slate-100 shadow-xl ring-1 ring-border">
              <div className="relative aspect-[3/4] w-full">
                {current ? (
                  <img
                    src={current.url}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center bg-gradient-to-br text-[10rem]",
                      product.coverColor ?? "from-slate-200 to-slate-400",
                    )}
                  >
                    {product.coverEmoji ?? <ImageIcon className="size-24 text-white/70" />}
                  </div>
                )}
                <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-black/5">
                  {productTypeLabel(product.type)}
                </span>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow ring-1 ring-black/5 hover:bg-white"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow ring-1 ring-black/5 hover:bg-white"
                      aria-label="Next image"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((img: { url: string }, i: number) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                      i === idx ? "border-brand" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    aria-label={`Show image ${i + 1}`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {product.subtitle && (
              <p className="text-sm font-medium text-muted-foreground">{product.subtitle}</p>
            )}
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              {product.title}
            </h1>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums">{formatBDT(product.price)}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through tabular-nums">
                  {formatBDT(product.originalPrice)}
                </span>
              )}
            </div>

            {product.stock !== undefined && product.stock !== null && product.stock > 0 && (
              <p className="mt-2 text-sm text-brand">
                <Check className="mr-1 inline size-4" />
                স্টকে আছে ({product.stock}+ কপি)
              </p>
            )}

            <div className="mt-6 border-t border-border pt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                বিবরণ
              </h3>
              <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">
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
                  পেমেন্ট সম্পন্ন হওয়ার পরপরই সিকিউর ডাউনলোড লিংক আপনার ইমেইলে পাঠানো হবে।
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
