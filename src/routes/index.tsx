import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  PlayCircle,
  Users,
  Award,
  Star,
  Plus,
  Minus,
  Sparkles,
  BookOpen,
  Radio,
  GraduationCap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/products";
import { listFeaturedProducts } from "@/lib/products.functions";
import { listPublicCourses, type PublicCourseCard as PublicCourseCardData } from "@/lib/lms.functions";
import { PublicCourseCard } from "@/components/public-course-card";
import { cn } from "@/lib/utils";
import { getHomepageBundle } from "@/lib/cms.functions";
import type { HomepageContent } from "@/lib/cms-types";

export const Route = createFileRoute("/")({
  loader: async () => await getHomepageBundle(),
  head: ({ loaderData }) => {
    const seo = loaderData?.seo;
    const title = seo?.meta_title || "Polytechnic Tutorial Home";
    const desc =
      seo?.meta_description ||
      "ডিপ্লোমা ইন ইঞ্জিনিয়ারিং শিক্ষার্থীদের জন্য ভিডিও কোর্স, লাইভ ক্লাস, নোটস, বই ও সুপার সাজেশন — এক জায়গায়।";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://polytechnictutorial.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (seo?.og_image_url) {
      meta.push({ property: "og:image", content: seo.og_image_url });
      meta.push({ name: "twitter:image", content: seo.og_image_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: "https://polytechnictutorial.com/" }],
    };
  },
  component: HomePage,
});

/* ---------- Page ---------- */

function HomePage() {
  const { homepage } = Route.useLoaderData();
  const fetchFeatured = useServerFn(listFeaturedProducts);
  const fetchCourses = useServerFn(listPublicCourses);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [courses, setCourses] = useState<PublicCourseCardData[]>([]);

  useEffect(() => {
    fetchFeatured({ data: undefined as never })
      .then((rows) => setFeatured((rows ?? []).slice(0, 4)))
      .catch(() => setFeatured([]));
  }, [fetchFeatured]);

  useEffect(() => {
    fetchCourses(undefined as never)
      .then((rows) => {
        const list = rows ?? [];
        const featured = list.filter((c) => c.is_featured);
        setCourses((featured.length > 0 ? featured : list).slice(0, 3));
      })
      .catch(() => setCourses([]));
  }, [fetchCourses]);

  return (
    <div className="relative overflow-hidden">
      <Hero c={homepage.hero} />
      <Stats items={homepage.stats} />
      <Courses c={homepage.courses} items={courses} />
      <ShopStrip c={homepage.shop} products={featured} />
      <About c={homepage.about} />
      <Testimonials c={homepage.testimonials} />
      <FAQ c={homepage.faq} />
      <CTA c={homepage.finalCta} />
    </div>
  );
}

/* ---------- Sections ---------- */

function Hero({ c }: { c: HomepageContent["hero"] }) {
  const fc = c.featuredCard;
  return (
    <section className="relative overflow-hidden border-b border-border/70 grain">
      <div className="pointer-events-none absolute inset-0 bg-paper-gradient" />
      <div className="pointer-events-none absolute -top-40 -right-32 size-[520px] rounded-full bg-brand/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[480px] rounded-full bg-[color:var(--indigo-deep)]/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-16 pb-20 md:grid-cols-12 md:gap-10 md:px-6 md:pt-24 md:pb-28 lg:pt-28">
        <div className="md:col-span-7">
          <div className="flex items-center gap-3">
            <span className="eyebrow">{c.eyebrowLeft}</span>
            <span className="h-px w-10 bg-gold" />
            <span className="eyebrow">{c.eyebrowRight}</span>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            {c.titleLine1}
            <br />
            {c.titleLine2Prefix}{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-brand">{c.titleHighlight}</span>
              <span className="absolute inset-x-0 bottom-1 h-3 rounded-sm bg-gold-gradient opacity-70" />
            </span>{" "}
            {c.titleLine2Suffix}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            {c.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <a
              href={c.ctaPrimaryHref}
              className="group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-[0_18px_40px_-16px_rgba(6,78,59,0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-14px_rgba(6,78,59,0.7)]"
            >
              {c.ctaPrimaryLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={c.ctaSecondaryHref}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:border-brand/40 hover:bg-background"
            >
              <PlayCircle className="size-4 text-brand" />
              {c.ctaSecondaryLabel}
            </a>
          </motion.div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {(c.socialProof.avatars ?? []).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`শিক্ষার্থী ${i + 1}`}
                    loading="lazy"
                    className="size-8 rounded-full border-2 border-background object-cover shadow-sm"
                  />
                ))}
              </div>
              <div className="text-sm">
                <div className="font-semibold">{c.socialProof.count}</div>
                <div className="text-xs text-muted-foreground">{c.socialProof.caption}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-gold text-gold" />
                ))}
              </div>
              <span className="text-sm font-medium">{c.socialProof.rating}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-editorial)] md:p-7">
              <div className="flex items-center justify-between">
                <span className="eyebrow">{fc.eyebrow}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand">
                  <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                  {fc.liveLabel}
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold leading-tight">
                {fc.titleLine1}
                <br />
                <span className="text-brand">{fc.titleLine2}</span>
              </h3>
              <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
                {fc.features.map((f, i) => (
                  <FeatureRow key={i} icon={[PlayCircle, Radio, BookOpen][i % 3]} label={f} />
                ))}
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <div className="eyebrow">{fc.priceLabel}</div>
                  <div className="font-display text-3xl font-extrabold text-brand">
                    {fc.price}
                    <span className="text-base font-medium text-muted-foreground">{fc.priceSuffix}</span>
                  </div>
                </div>
                <a
                  href={fc.ctaHref}
                  className="inline-flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:-translate-y-0.5 hover:rotate-45"
                  aria-label="See courses"
                >
                  <ArrowUpRight className="size-5" />
                </a>
              </div>
            </div>

            <div className="absolute -top-4 -left-4 hidden rotate-[-8deg] rounded-2xl border border-gold/40 bg-gold-gradient px-4 py-2 shadow-[var(--shadow-gold)] md:block">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--ink)]">
                {fc.badge}
              </div>
            </div>

            <div className="absolute -bottom-6 -right-4 hidden rotate-[4deg] rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-editorial)] md:block">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-brand/10 text-brand">
                  <GraduationCap className="size-5" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold leading-tight">{fc.floatingTitle}</div>
                  <div className="text-[11px] text-muted-foreground">{fc.floatingSubtitle}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
        <Icon className="size-3.5" />
      </span>
      <span className="text-foreground/85">{label}</span>
    </div>
  );
}

function Stats({ items }: { items: HomepageContent["stats"] }) {
  return (
    <section className="relative border-b border-border/70 bg-foreground text-background">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 gap-x-6 px-4 py-12 md:grid-cols-4 md:px-6 md:py-14">
        {items.map((s, i) => (
          <div key={i} className={cn("relative", i > 0 && "md:pl-6 md:border-l md:border-background/15")}>
            <div className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{s.value}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-background/60 md:text-sm">
              <span className="h-px w-6 bg-gold" />
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Courses({ c, items }: { c: HomepageContent["courses"]; items: PublicCourseCardData[] }) {
  return (
    <section id="courses" className="scroll-mt-20 px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <SectionEyebrow index={c.index} label={c.eyebrow} />
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              {c.titleLine1}
              <br />
              <span className="italic text-brand">{c.titleHighlight}</span> {c.titleLine2Suffix}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {c.description}
            </p>
          </div>
          <div className="md:col-span-4 md:text-right">
            <a
              href={c.ctaHref}
              className="group inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:-translate-y-0.5 hover:bg-brand hover:border-brand hover:shadow-[0_18px_40px_-16px_rgba(6,78,59,0.55)]"
            >
              {c.ctaLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>

        <div className="my-10 hairline" />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center text-sm text-muted-foreground">
            {c.emptyLabel}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <PublicCourseCard course={course} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ShopStrip({ c, products }: { c: HomepageContent["shop"]; products: Product[] }) {
  return (
    <section className="relative px-4 py-24 md:px-6 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-editorial-gradient p-6 shadow-[var(--shadow-editorial)] md:p-12">
          <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-[color:var(--indigo-deep)]/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:24px_24px]" />

          <div className="relative grid gap-8 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <SectionEyebrow index={c.index} label={c.eyebrow} tone="light" />
              <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.35] tracking-tight text-[color:var(--background)] md:text-5xl md:leading-[1.25]">
                {c.titleLine1}
                <br />
                {c.titleLine2Prefix} <span className="italic text-gold">{c.titleHighlight}</span>
                {c.titleLine2Suffix}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--background)]/75 md:text-base">
                {c.description}
              </p>
            </div>
            <div className="md:col-span-4 md:text-right">
              <a
                href={c.ctaHref}
                className="group inline-flex items-center gap-2 rounded-full bg-gold-gradient px-6 py-3.5 text-sm font-bold text-[color:var(--ink)] shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5"
              >
                {c.ctaLabel}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          <div className="relative mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function iconForName(name: string): React.ElementType {
  switch (name) {
    case "award":
      return Award;
    case "play":
      return PlayCircle;
    case "users":
      return Users;
    case "book":
      return BookOpen;
    case "radio":
      return Radio;
    case "star":
      return Star;
    case "sparkles":
      return Sparkles;
    default:
      return Sparkles;
  }
}

function About({ c }: { c: HomepageContent["about"] }) {
  return (
    <section id="about" className="scroll-mt-20 border-t border-border/70 bg-surface px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-6">
          <SectionEyebrow index={c.index} label={c.eyebrow} />
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {c.titleLine1}
            <br />
            {c.titleLine2Prefix} <span className="italic text-brand">{c.titleHighlight}</span>
            {c.titleLine2Suffix}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">{c.paragraph1}</p>
          {c.paragraph2 && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{c.paragraph2}</p>
          )}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-background/60 px-4 py-2 text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-gold" />
            {c.badge}
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="space-y-4">
            {c.features.map((p, i) => {
              const Icon = iconForName(p.icon);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative flex gap-5 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--shadow-editorial)] md:p-6"
                >
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-editorial-gradient text-background shadow-[var(--shadow-editorial)]">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="font-inter text-xs font-bold text-gold">0{i + 1}</span>
                      <h3 className="font-display text-lg font-bold">{p.title}</h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials({ c }: { c: HomepageContent["testimonials"] }) {
  return (
    <section id="testimonials" className="scroll-mt-20 px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <SectionEyebrow index={c.index} label={c.eyebrow} />
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {c.titleLine1}
            <br />
            <span className="italic text-brand">{c.titleHighlight}</span>
            {c.titleLine2Suffix}
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {c.items.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-editorial)]",
                i === 1 && "md:mt-8 md:bg-foreground md:text-background md:border-foreground",
              )}
            >
              <span className="absolute -top-3 left-6 font-display text-6xl leading-none text-gold">“</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="size-3.5 fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed">{t.text}</blockquote>
              <figcaption
                className={cn("mt-6 flex items-center gap-3 border-t pt-4", i === 1 ? "border-background/15" : "border-border")}
              >
                <div className="grid size-9 place-items-center rounded-full bg-gold-gradient font-display text-xs font-bold text-[color:var(--ink)]">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className={cn("text-xs", i === 1 ? "text-background/60" : "text-muted-foreground")}>
                    {t.role}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ({ c }: { c: HomepageContent["faq"] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border/70 bg-surface px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <SectionEyebrow index={c.index} label={c.eyebrow} />
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {c.titleLine1}
            <br />
            <span className="italic text-brand">{c.titleHighlight}</span>
            {c.titleLine2Suffix}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            {c.description}
          </p>
        </div>
        <div className="md:col-span-7">
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {c.items.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-secondary/50"
                  >
                    <span className="flex items-center gap-4">
                      <span className="font-inter text-xs font-bold text-gold">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-base font-semibold md:text-lg">{f.q}</span>
                    </span>
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border border-border transition-all",
                        isOpen && "bg-brand text-brand-foreground border-brand rotate-180",
                      )}
                    >
                      {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pl-16 text-sm leading-relaxed text-muted-foreground">{f.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA({ c }: { c: HomepageContent["finalCta"] }) {
  return (
    <section className="px-4 py-24 md:px-6 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-editorial-gradient px-6 py-16 text-center shadow-[var(--shadow-editorial)] md:px-16 md:py-20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gold-gradient" />
          <div className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:32px_32px]" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-[color:var(--ink)]/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold backdrop-blur">
              <Sparkles className="size-3.5" />
              {c.badge}
            </div>
            <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.35] tracking-tight text-[color:var(--background)] md:text-6xl md:leading-[1.2]">
              {c.titleLine1}
              <br />
              {c.titleLine2Prefix} <span className="italic text-gold">{c.titleHighlight}</span>
              {c.titleLine2Suffix}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm text-[color:var(--background)]/75 md:text-base">
              {c.description}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href={c.ctaPrimaryHref}
                className="group inline-flex items-center gap-2 rounded-full bg-gold-gradient px-7 py-4 text-sm font-bold text-[color:var(--ink)] shadow-[var(--shadow-gold)] transition-all hover:-translate-y-0.5"
              >
                {c.ctaPrimaryLabel}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href={c.ctaSecondaryHref}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--background)]/30 px-7 py-4 text-sm font-semibold text-[color:var(--background)] backdrop-blur transition-colors hover:bg-[color:var(--background)]/10"
              >
                {c.ctaSecondaryLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Helpers ---------- */

function SectionEyebrow({ index, label, tone }: { index: string; label: string; tone?: "light" }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("font-display text-xs font-bold", tone === "light" ? "text-gold" : "text-gold")}>
        {index}
      </span>
      <span className="h-px w-10 bg-gold" />
      <span className={cn("eyebrow", tone === "light" && "!text-[color:var(--background)]/70")}>{label}</span>
    </div>
  );
}
