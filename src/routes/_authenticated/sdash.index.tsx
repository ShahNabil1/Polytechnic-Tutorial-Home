import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  ShoppingBag,
  GraduationCap,
  ArrowRight,
  ArrowUpRight,
  PlayCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listCourseCatalog } from "@/lib/lms.functions";
import { listFeaturedProducts } from "@/lib/products.functions";
import type { Product } from "@/lib/products";
import { formatBDT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sdash/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const listCourses = useServerFn(listCourseCatalog);
  const listFeatured = useServerFn(listFeaturedProducts);
  const [courses, setCourses] = useState<any[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const name =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.phone ||
    user?.email ||
    "শিক্ষার্থী";

  useEffect(() => {
    let mounted = true;
    Promise.all([
      listCourses(undefined as never).catch(() => []),
      listFeatured(undefined as never).catch(() => []),
    ]).then(([c, f]) => {
      if (!mounted) return;
      setCourses((c as any[]) ?? []);
      setFeatured(((f as Product[]) ?? []).slice(0, 4));
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [listCourses, listFeatured]);

  const enrolled = useMemo(() => courses.filter((c) => c.has_access), [courses]);
  const available = useMemo(() => courses.filter((c) => !c.has_access).slice(0, 6), [courses]);

  const firstName = String(name).split(/\s+/)[0];
  const greeting = useMemo(() => {
    // Static greeting to avoid SSR hydration mismatch.
    return "শুভেচ্ছা";
  }, []);
  const toBn = (n: number) =>
    String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

  return (
    <div className="space-y-10">
      {/* Editorial hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
          <div className="relative p-6 md:p-10">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {greeting} · শিক্ষার্থী পোর্টাল
            </div>
            <h1 className="mt-3 font-display text-3xl md:text-4xl font-bold leading-[1.15] tracking-tight text-slate-900">
              স্বাগতম,
              <br />
              <span className="text-brand">{firstName}</span>
              <span className="text-slate-900">.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm md:text-[15px] leading-relaxed text-slate-600">
              আজকের লক্ষ্য একটাই — একটা লেসন শেষ করা। কোর্স ব্রাউজ করুন, নোট নিন,
              প্রয়োজনীয় বই কিনুন। সব কিছু এক জায়গায়।
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/sdash/courses"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                কোর্স ব্রাউজ করুন
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/sdash/shop"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                শপে যান
              </Link>
            </div>
          </div>

          {/* Right rail — quiet decorative panel with real content */}
          <div className="relative border-t border-slate-200 md:border-l md:border-t-0 bg-[radial-gradient(circle_at_top_right,theme(colors.brand/0.08),transparent_60%),radial-gradient(circle_at_bottom_left,theme(colors.amber.100/0.6),transparent_55%)] p-6 md:p-8">
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    আজকের সারাংশ
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-bold text-slate-900 tabular-nums">
                      {loading ? "—" : toBn(enrolled.length)}
                    </span>
                    <span className="text-sm text-slate-500">এনরোল্ড কোর্স</span>
                  </div>
                </div>
                <div className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-slate-200">
                  <GraduationCap className="size-5 text-brand" />
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 pt-4">
                <div className="pr-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    ক্যাটালগ
                  </div>
                  <div className="mt-0.5 font-display text-xl font-semibold text-slate-900 tabular-nums">
                    {loading ? "—" : toBn(courses.length)}
                  </div>
                </div>
                <div className="pl-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">
                    ফিচার্ড
                  </div>
                  <div className="mt-0.5 font-display text-xl font-semibold text-slate-900 tabular-nums">
                    {loading ? "—" : toBn(featured.length)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Continue learning */}
      <section>
        <SectionHeader
          title="আপনার কোর্স"
          subtitle={enrolled.length > 0 ? "লার্নিং কন্টিনিউ করুন" : "এখনো কোনো কোর্সে এনরোল হননি"}
          action={{ to: "/sdash/courses", label: "সকল কোর্স" }}
        />
        {loading ? (
          <SkeletonGrid />
        ) : enrolled.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="কোনো এনরোল্ড কোর্স নেই"
            body="ব্রাউজ ট্যাব থেকে কোর্স খুঁজে বের করে এনরোল করুন।"
            cta={{ to: "/sdash/courses", label: "কোর্স ব্রাউজ করুন" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.slice(0, 6).map((c) => (
              <CourseCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Available courses */}
      {!loading && available.length > 0 && (
        <section>
          <SectionHeader
            title="নতুন কোর্স আবিষ্কার করুন"
            subtitle="আপনার সেমিস্টারের জন্য উপযুক্ত কোর্স"
            action={{ to: "/sdash/courses", label: "সব দেখুন" }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((c) => (
              <CourseCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      {/* Shop featured */}
      <section>
        <SectionHeader
          title="ফিচার্ড প্রোডাক্ট"
          subtitle="বই, ই-বুক ও সুপার সাজেশন"
          action={{ to: "/sdash/shop", label: "শপে যান" }}
        />
        {loading ? (
          <SkeletonGrid />
        ) : featured.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="ফিচার্ড প্রোডাক্ট নেই"
            body="শপ পেজ থেকে সব প্রোডাক্ট ব্রাউজ করুন।"
            cta={{ to: "/sdash/shop", label: "শপ খুলুন" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <MiniProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-1 rounded-full bg-brand" />
          <h2 className="font-display text-xl md:text-[22px] font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="mt-1 pl-[14px] text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-brand"
        >
          {action.label}
          <ArrowUpRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function CourseCard({ c }: { c: any }) {
  return (
    <Link
      to="/sdash/courses/$deptSlug/$semSlug"
      params={{ deptSlug: c.department_slug, semSlug: c.semester_slug }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.25)]"
    >
      <div className="aspect-[16/10] relative bg-slate-100 overflow-hidden">
        {c.cover_image_url ? (
          <img
            src={c.cover_image_url}
            alt={c.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center bg-[linear-gradient(135deg,#f8fafc,#eef2f7)]">
            <GraduationCap className="size-12 text-slate-400/70" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {c.has_access ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 text-emerald-700 text-[11px] font-medium px-2 py-0.5 ring-1 ring-emerald-100 backdrop-blur">
            <CheckCircle2 className="size-3" /> এনরোল্ড
          </span>
        ) : (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/85 text-slate-700 text-[11px] font-medium px-2 py-0.5 ring-1 ring-slate-200 backdrop-blur">
            <Lock className="size-3" /> লকড
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {c.department_name} · {c.semester_name}
        </div>
        <h3 className="mt-1.5 font-semibold text-slate-900 line-clamp-2 leading-snug">
          {c.title}
        </h3>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <PlayCircle className="size-3.5" />
            {c.subject_count ?? 0} সাবজেক্ট
          </div>
          {c.has_access ? (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
              চালিয়ে যান <ArrowRight className="size-3.5" />
            </span>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {formatBDT(c.price_bdt)}
              </span>
              {c.compare_at_price_bdt && c.compare_at_price_bdt > c.price_bdt && (
                <span className="text-xs text-slate-400 line-through">
                  {formatBDT(c.compare_at_price_bdt)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MiniProductCard({ p }: { p: Product }) {
  const cover = p.ogImage || p.images?.[0]?.url;
  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand/40 hover:shadow-lg"
    >
      <div className="aspect-[4/5] bg-slate-100">
        {cover ? (
          <img
            src={cover}
            alt={p.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <ShoppingBag className="size-10 text-slate-400/70" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{p.title}</h3>
        <div className="mt-1.5 text-sm font-bold text-brand">{formatBDT(p.price)}</div>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="aspect-video animate-pulse bg-slate-100" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof BookOpen;
  title: string;
  body: string;
  cta?: { to: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
        <Icon className="size-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
        >
          {cta.label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
