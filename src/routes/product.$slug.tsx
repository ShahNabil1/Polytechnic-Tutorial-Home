import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, ShoppingCart, Zap, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { productTypeLabel } from "@/lib/products";
import { getPublicProductBySlug, listPublicProducts } from "@/lib/products.functions";
import { useCart } from "@/lib/cart-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";


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
    const all = await listPublicProducts().catch(() => []);
    const others = all.filter((p) => p.id !== product.id);
    // Prefer same type, then same department overlap; fallback to remaining
    const sameType = others.filter((p) => p.type === product.type);
    const sameDept = others.filter(
      (p) => p.departments?.some((d) => product.departments?.includes(d)),
    );
    const seen = new Set<string>();
    const ranked = [...sameDept, ...sameType, ...others].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    const suggestions = ranked.slice(0, 8);
    return { product, suggestions };
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
      sku: p.sku ?? p.id,
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
  const { product, suggestions } = Route.useLoaderData();

  const navigate = useNavigate();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.some((i) => i.productId === product.id));
  const [idx, setIdx] = useState(0);

  const isDigital = product.type !== "physical";
  const images = product.images ?? [];
  const hasImages = images.length > 0;
  const current = hasImages ? images[Math.min(idx, images.length - 1)] : null;

  const productUrl = `${SITE_URL}/product/${product.slug}`;
  const waMessage = `আসসালামু আলাইকুম,\n\nআমি এই বইটি অর্ডার করতে চাই:\n\n📘 ${product.title}\n💵 মূল্য: ${formatBDT(product.price)}\n🔗 ${productUrl}\n\nঅনুগ্রহ করে অর্ডার প্রসেস করুন।`;
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleBuyNow = () => {
    if (!inCart) add(product);
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
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-black/5 md:right-4 md:top-4 md:px-3 md:py-1.5 md:text-xs">
                  {productTypeLabel(product.type)}
                </span>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow ring-1 ring-black/5 hover:bg-white md:left-3 md:size-10"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="size-4 md:size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow ring-1 ring-black/5 hover:bg-white md:right-3 md:size-10"
                      aria-label="Next image"
                    >
                      <ChevronRight className="size-4 md:size-5" />
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
                      "size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all md:size-16",
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
              <p className="order-1 text-xs font-bold text-muted-foreground md:text-sm">{product.subtitle}</p>
            )}
            <h1 className="order-2 mt-1 text-xl font-extrabold tracking-tight sm:text-2xl md:mt-2 md:text-3xl lg:text-[2rem] lg:leading-tight">
              {product.title}
            </h1>

            <div className="order-3 mt-3 flex items-baseline gap-2.5 md:mt-4">
              <span className="text-xl font-extrabold tabular-nums md:text-2xl lg:text-[1.75rem]">{formatBDT(product.price)}</span>
              {product.originalPrice && (
                <span className="text-sm font-semibold text-muted-foreground line-through tabular-nums md:text-base">
                  {formatBDT(product.originalPrice)}
                </span>
              )}
            </div>

            {product.stock !== undefined && product.stock !== null && product.stock > 0 && (
              <p className="order-4 mt-1.5 text-xs font-bold text-brand md:text-sm">
                <Check className="mr-1 inline size-3.5 md:size-4" />
                স্টকে আছে ({product.stock}+ কপি)
              </p>
            )}

            <div className="order-5 mt-5 grid grid-cols-2 gap-2.5 md:mt-7 md:gap-3 lg:order-7">
              <button
                onClick={() => add(product)}
                className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 border-foreground/90 bg-background px-3 py-2.5 text-[13px] font-extrabold tracking-wide text-foreground shadow-[0_6px_0_-1px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:bg-foreground hover:text-background active:translate-y-0 md:gap-2 md:rounded-2xl md:px-6 md:py-3.5 md:text-sm"
              >
                <ShoppingCart className="size-4" />
                {inCart ? "Added To Cart" : "Add To Cart"}
              </button>
              <button
                onClick={handleBuyNow}
                className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-brand via-brand to-brand/80 px-3 py-2.5 text-[13px] font-extrabold tracking-wide text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40 active:translate-y-0 md:gap-2 md:rounded-2xl md:px-6 md:py-3.5 md:text-sm"
              >
                <Zap className="size-4 fill-current" />
                Buy Now
              </button>
            </div>

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="order-6 mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-[13px] font-extrabold tracking-wide text-white shadow-lg shadow-[#25D366]/25 transition-all hover:-translate-y-0.5 hover:bg-[#1ebe57] hover:shadow-xl hover:shadow-[#25D366]/40 active:translate-y-0 md:mt-3 md:gap-3 md:rounded-2xl md:px-6 md:py-3.5 md:text-sm lg:order-8"
            >
              <WhatsAppIcon className="size-5" />
              Order On Whatsapp
            </a>

            <div className="order-7 mt-6 border-t border-border pt-5 lg:order-5 lg:pt-6">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:text-xs">
                বিবরণ
              </h3>
              <p className="whitespace-pre-line text-[13.5px] font-medium leading-relaxed text-foreground/90 md:text-sm lg:text-[15px]">
                {product.description}
              </p>
            </div>

            {isDigital && (
              <div className="order-8 mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-900 md:mt-6 md:p-4 md:text-sm lg:order-9">
                <p className="font-extrabold">📥 ইনস্ট্যান্ট ডাউনলোড</p>
                <p className="mt-1">
                  পেমেন্ট সম্পন্ন হওয়ার পরপরই সিকিউর ডাউনলোড লিংক আপনার ইমেইলে পাঠানো হবে।
                </p>
              </div>
            )}
          </div>

        </div>

        {suggestions.length > 0 && (
          <section className="mt-16 md:mt-20">
            <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand md:text-sm">
                  আরও দেখুন
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl lg:text-3xl">
                  আপনার পছন্দ হতে পারে এমন অন্যান্য বই
                </h2>
              </div>
              <Link
                to="/shop"
                className="hidden shrink-0 text-sm font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline"
              >
                সব বই →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
              {suggestions.map((p: typeof product) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>

  );
}
