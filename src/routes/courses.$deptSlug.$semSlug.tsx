import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Lock,
  PlayCircle,
  Tag,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  enrollInCourseTest,
  getPublicCourseByPair,
  type PublicCourseDetail,
} from "@/lib/lms.functions";
import { validateCoupon } from "@/lib/coupons.functions";
import { supabase } from "@/integrations/supabase/client";
import { toBanglaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SITE_URL = "https://polytechnictutorial.com";

export const Route = createFileRoute("/courses/$deptSlug/$semSlug")({
  loader: async ({ params }) => {
    const data = await getPublicCourseByPair({
      data: { dept_slug: params.deptSlug, sem_slug: params.semSlug },
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/courses/${params.deptSlug}/${params.semSlug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "কোর্স পাওয়া যায়নি — Polytechnic Tutorial Home" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const c = loaderData.course;
    const title = c.meta_title || `${c.title} — Polytechnic Tutorial Home`;
    const description =
      c.meta_description ||
      (c.description
        ? c.description.slice(0, 200)
        : `${c.department_name} ${c.semester_name} এর সম্পূর্ণ কোর্স — ${toBanglaNumber(c.subject_count)} সাব্জেক্ট, ${toBanglaNumber(c.lesson_count)} লেসন।`);
    const image = c.media_items.find((m) => m.type === "image")?.url || c.cover_image_url;

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Course",
      name: c.title,
      description,
      url,
      provider: {
        "@type": "Organization",
        name: "Polytechnic Tutorial Home",
        sameAs: SITE_URL,
      },
      about: `${c.department_name} · ${c.semester_name}`,
      offers: {
        "@type": "Offer",
        price: c.price_bdt,
        priceCurrency: "BDT",
        availability: "https://schema.org/InStock",
        url,
      },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
      },
    };
    if (image) (jsonLd as any).image = image;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
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
  component: PublicCoursePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">কিছু একটা ভুল হয়েছে</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Link to="/courses" className="mt-6 inline-block text-brand hover:underline">
        সব কোর্স দেখুন →
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold">কোর্স পাওয়া যায়নি</h1>
      <Link to="/courses" className="mt-6 inline-block text-brand hover:underline">
        সব কোর্স দেখুন →
      </Link>
    </div>
  ),
});

function PublicCoursePage() {
  const data: PublicCourseDetail = Route.useLoaderData();
  const { deptSlug, semSlug } = Route.useParams();
  const { course, subjects } = data;
  const navigate = useNavigate();

  const enrollFn = useServerFn(enrollInCourseTest);
  const validateFn = useServerFn(validateCoupon);

  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    name: string | null;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: sess }) => {
      if (!mounted) return;
      setUserId(sess.session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const heroMedia = useMemo(() => {
    if (course.media_items.length > 0) return course.media_items;
    if (course.cover_image_url) {
      return [{ id: "cover", type: "image" as const, url: course.cover_image_url }];
    }
    return [];
  }, [course]);
  const activeMedia = heroMedia[activeMediaIdx];

  const effectivePrice = Math.max(
    0,
    course.price_bdt - (appliedCoupon?.discount ?? 0),
  );

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const res = await validateFn({
        data: {
          code,
          subtotal: course.price_bdt,
          productIds: [course.id],
          scope: "course",
        },
      } as never);
      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponError(
          res.reason === "min_spend"
            ? "মিনিমাম স্পেন্ড পূরণ হয়নি।"
            : res.reason === "expired"
              ? "কুপনের মেয়াদ শেষ।"
              : res.reason === "not_applicable"
                ? "এই কোর্সে এই কুপন প্রযোজ্য নয়।"
                : "কুপন অবৈধ।",
        );
        return;
      }
      setAppliedCoupon({
        code: res.code ?? code,
        discount: res.discount,
        name: res.name,
      });
      toast.success(`কুপন প্রয়োগ হয়েছে — ৳${toBanglaNumber(res.discount)} ছাড়`);
    } catch (e: any) {
      setCouponError(e?.message ?? "কুপন যাচাই ব্যর্থ");
    } finally {
      setCheckingCoupon(false);
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function handleEnroll() {
    if (!userId) {
      // Redirect to /auth then come back to this page after login.
      const returnTo = `/courses/${deptSlug}/${semSlug}`;
      toast.info("এনরোল করতে সাইন ইন করুন।");
      navigate({ to: "/auth", search: { redirect: returnTo } as never });
      return;
    }
    setEnrolling(true);
    try {
      await enrollFn({
        data: {
          course_id: course.id,
          coupon_code: appliedCoupon?.code ?? null,
        },
      } as never);
      toast.success("এনরোলমেন্ট সফল! কোর্সে চলে যাচ্ছি...");
      navigate({
        to: "/sdash/courses/$deptSlug/$semSlug",
        params: { deptSlug, semSlug },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "এনরোল ব্যর্থ হয়েছে");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/courses"
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground md:mb-6"
        >
          <ArrowLeft className="size-4" />
          সব কোর্স
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          {/* Media gallery */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-xl">
              <div className="relative aspect-video">
                {activeMedia ? (
                  activeMedia.type === "video" ? (
                    <video src={activeMedia.url} controls className="h-full w-full" />
                  ) : (
                    <img
                      src={activeMedia.url}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100">
                    <GraduationCap className="size-16 text-slate-400/60" />
                  </div>
                )}
              </div>
            </div>
            {heroMedia.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {heroMedia.map((m, idx) => {
                  const active = idx === activeMediaIdx;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveMediaIdx(idx)}
                      className={cn(
                        "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all md:size-20",
                        active
                          ? "border-brand"
                          : "border-transparent opacity-70 hover:opacity-100",
                      )}
                      aria-label={`Show media ${idx + 1}`}
                    >
                      {m.type === "video" ? (
                        <>
                          <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
                          <div className="absolute inset-0 grid place-items-center bg-black/40">
                            <PlayCircle className="size-5 text-white" />
                          </div>
                        </>
                      ) : (
                        <img src={m.url} alt="" className="h-full w-full object-cover" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info + Enroll */}
          <div className="flex flex-col">
            <p className="text-xs font-bold uppercase tracking-wider text-brand md:text-sm">
              {course.department_name} · {course.semester_name}
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold leading-tight tracking-tight md:text-3xl lg:text-[2rem]">
              {course.title}
            </h1>

            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground md:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" />
                {toBanglaNumber(course.subject_count)} সাব্জেক্ট
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle className="size-4" />
                {toBanglaNumber(course.lesson_count)} লেসন
              </span>
            </div>

            {course.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/85 md:text-[15px]">
                {course.description}
              </p>
            )}

            {/* Price + coupon + enroll card */}
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold tabular-nums">
                  ৳{toBanglaNumber(effectivePrice)}
                </span>
                {(appliedCoupon ||
                  (course.compare_at_price_bdt &&
                    course.compare_at_price_bdt > course.price_bdt)) && (
                  <span className="text-sm text-muted-foreground line-through tabular-nums">
                    ৳{toBanglaNumber(
                      appliedCoupon ? course.price_bdt : course.compare_at_price_bdt!,
                    )}
                  </span>
                )}
              </div>

              {/* Coupon field */}
              <div className="mt-4">
                <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Tag className="size-3.5" />
                  কুপন কোড
                </label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <div className="flex items-center gap-1.5 font-extrabold text-emerald-700">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span className="truncate">{appliedCoupon.code}</span>
                      </div>
                      <div className="text-xs text-emerald-700/80">
                        ৳{toBanglaNumber(appliedCoupon.discount)} ছাড় প্রয়োগ হয়েছে
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCoupon}
                      className="shrink-0 rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
                      aria-label="Remove coupon"
                    >
                      <XCircle className="size-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="কোড লিখুন"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium uppercase tracking-wider focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyCoupon();
                      }}
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={checkingCoupon || !couponInput.trim()}
                      className="shrink-0 rounded-lg border-2 border-foreground bg-background px-4 py-2 text-sm font-extrabold transition-all hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      {checkingCoupon ? <Loader2 className="size-4 animate-spin" /> : "প্রয়োগ"}
                    </button>
                  </div>
                )}
                {couponError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">{couponError}</p>
                )}
              </div>

              {/* Enroll button */}
              <button
                type="button"
                onClick={handleEnroll}
                disabled={enrolling || !authChecked}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand via-brand to-brand/80 px-6 py-3.5 text-sm font-extrabold tracking-wide text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40 disabled:pointer-events-none disabled:opacity-60"
              >
                {enrolling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Zap className="size-4 fill-current" />
                )}
                {enrolling
                  ? "প্রসেসিং..."
                  : userId
                    ? "এনরোল করুন"
                    : "সাইন ইন করে এনরোল করুন"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                (টেস্ট মোড: Paystation gateway এর জায়গায় ইনস্ট্যান্ট এনরোল)
              </p>
            </div>
          </div>
        </div>

        {/* Curriculum */}
        <section className="mt-12">
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">কারিকুলাম</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {toBanglaNumber(course.subject_count)}টি সাব্জেক্ট · {toBanglaNumber(course.lesson_count)}টি লেসন
          </p>

          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-card p-3">
            {subjects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                এই কোর্সে এখনো কোনো সাব্জেক্ট যোগ করা হয়নি।
              </div>
            ) : (
              subjects.map((s) => {
                const open = !!openSubjects[s.id];
                const totalLessons = s.modules.reduce((a, m) => a + m.lesson_count, 0);
                return (
                  <div key={s.id} className="rounded-lg">
                    <button
                      type="button"
                      onClick={() => setOpenSubjects((p) => ({ ...p, [s.id]: !p[s.id] }))}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left hover:bg-secondary"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {toBanglaNumber(s.modules.length)} মডিউল · {toBanglaNumber(totalLessons)} লেসন
                        </div>
                      </div>
                      {open ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                    </button>
                    {open && (
                      <div className="ml-3 border-l border-border pl-3">
                        {s.modules.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            কোনো মডিউল নেই
                          </div>
                        ) : (
                          s.modules.map((m) => (
                            <div key={m.id} className="py-1.5">
                              <div className="px-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                                {m.title} · {toBanglaNumber(m.lesson_count)} লেসন
                              </div>
                              {m.lessons.map((l) => (
                                <div
                                  key={l.id}
                                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                                >
                                  {l.is_free ? (
                                    <PlayCircle className="size-3.5 shrink-0 text-brand" />
                                  ) : (
                                    <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{l.title}</span>
                                  {l.is_free && (
                                    <span className="ml-auto text-[10px] font-bold uppercase text-emerald-600">
                                      ফ্রি
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
