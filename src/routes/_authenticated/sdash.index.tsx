import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  ShoppingBag,
  GraduationCap,
  ArrowRight,
  Sparkles,
  PlayCircle,
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
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

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-emerald-700 text-white p-6 md:p-8">
        <div className="relative z-10 flex flex-wrap items-center gap-6 justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="size-3.5" /> Learning Portal
            </div>
            <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
              স্বাগতম, {name} 👋
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/85 max-w-xl">
              আপনার লার্নিং জার্নি এক জায়গায়। কোর্স ব্রাউজ করুন, বই কিনুন, প্রগ্রেস ট্র্যাক করুন।
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/sdash/courses"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-white/90"
              >
                কোর্স ব্রাউজ করুন <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/sdash/shop"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
              >
                শপে যান <ShoppingBag className="size-4" />
              </Link>
            </div>
          </div>
          <div className="hidden md:grid size-40 place-items-center rounded-full bg-white/10 backdrop-blur">
            <GraduationCap className="size-20 text-white/80" />
          </div>
        </div>
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -left-10 -bottom-10 size-48 rounded-full bg-white/5 blur-2xl" />
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="এনরোল্ড কোর্স"
          value={loading ? "—" : String(enrolled.length)}
          tone="brand"
          hint="আপনি যেসব কোর্সে এ্যাক্সেস পেয়েছেন"
        />
        <StatCard
          icon={TrendingUp}
          label="উপলব্ধ কোর্স"
          value={loading ? "—" : String(courses.length)}
          tone="sky"
          hint="মোট কোর্স ক্যাটালগ"
        />
        <StatCard
          icon={Package}
          label="শপ প্রোডাক্ট"
          value={loading ? "—" : `${featured.length}+`}
          tone="amber"
          hint="ফিচার্ড বই ও সাজেশন"
        />
        <StatCard
          icon={CheckCircle2}
          label="একাউন্ট"
          value="Active"
          tone="emerald"
          hint="প্রোফাইল আপডেট রাখুন"
        />
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

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
  tone: "brand" | "sky" | "amber" | "emerald";
}) {
  const toneMap: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className={`grid size-10 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg md:text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80"
        >
          {action.label} <ArrowRight className="size-4" />
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
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand/40 hover:shadow-lg"
    >
      <div className="aspect-video relative bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100">
        {c.cover_image_url ? (
          <img
            src={c.cover_image_url}
            alt={c.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <GraduationCap className="size-12 text-slate-400/70" />
          </div>
        )}
        {c.has_access && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[11px] font-semibold px-2 py-0.5 shadow">
            <CheckCircle2 className="size-3" /> Enrolled
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {c.department_name} · {c.semester_name}
        </div>
        <h3 className="mt-1 font-semibold text-slate-900 line-clamp-2">{c.title}</h3>
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1 text-xs text-slate-500">
            <PlayCircle className="size-3.5" /> {c.subject_count ?? 0} subjects
          </div>
          {c.has_access ? (
            <span className="text-sm font-semibold text-emerald-600">Continue →</span>
          ) : (
            <span className="text-sm font-bold text-brand">{formatBDT(c.price_bdt)}</span>
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
