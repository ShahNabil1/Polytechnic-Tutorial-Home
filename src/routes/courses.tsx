import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BookOpen, Clock, PlayCircle, GraduationCap } from "lucide-react";
import { listPublicCourses, type PublicCourseCard } from "@/lib/lms.functions";
import { toBanglaNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const SITE_URL = "https://polytechnictutorial.com";

const searchSchema = z.object({
  department: z.string().optional(),
  semester: z.string().optional(),
});

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "সকল কোর্স — Polytechnic Tutorial Home" },
      {
        name: "description",
        content:
          "ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী পলিটেকনিকের সম্পূর্ণ কোর্স বান্ডেল — ভিডিও লেকচার, লাইভ ক্লাস ও সাজেশনসহ।",
      },
      { property: "og:title", content: "সকল কোর্স — Polytechnic Tutorial Home" },
      {
        property: "og:description",
        content:
          "ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী পলিটেকনিকের সম্পূর্ণ কোর্স বান্ডেল।",
      },
      { property: "og:url", content: `${SITE_URL}/courses` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/courses` }],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: CoursesPage,
});

function CoursesPage() {
  const { department, semester } = Route.useSearch();
  const fetchCourses = useServerFn(listPublicCourses);
  const [courses, setCourses] = useState<PublicCourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchCourses(undefined as never)
      .then((rows) => {
        if (!mounted) return;
        setCourses(rows ?? []);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [fetchCourses]);

  const departments = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    courses.forEach((c) => map.set(c.department_slug, { slug: c.department_slug, name: c.department_name }));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [courses]);

  const semesters = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    courses.forEach((c) => map.set(c.semester_slug, { slug: c.semester_slug, name: c.semester_name }));
    return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  }, [courses]);

  const filtered = useMemo(
    () =>
      courses.filter((c) => {
        if (department && c.department_slug !== department) return false;
        if (semester && c.semester_slug !== semester) return false;
        return true;
      }),
    [courses, department, semester],
  );

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">সকল কোর্স</h1>
          <p className="mt-2 font-semibold text-muted-foreground">
            ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী কমপ্লিট কোর্স বান্ডেল বেছে নিন।
          </p>
        </div>

        <div className="mb-8 space-y-5 rounded-2xl border border-border bg-card p-5">
          <FilterRow label="ডিপার্টমেন্ট">
            <FilterChip active={!department} search={{ semester }}>
              সব বিভাগ
            </FilterChip>
            {departments.map((d) => (
              <FilterChip
                key={d.slug}
                active={department === d.slug}
                search={{ department: d.slug, semester }}
              >
                {d.name}
              </FilterChip>
            ))}
          </FilterRow>

          <FilterRow label="সেমিস্টার">
            <FilterChip active={!semester} search={{ department }}>
              সব
            </FilterChip>
            {semesters.map((s) => (
              <FilterChip
                key={s.slug}
                active={semester === s.slug}
                search={{ department, semester: s.slug }}
              >
                {s.name}
              </FilterChip>
            ))}
          </FilterRow>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video w-full rounded-xl bg-slate-200" />
                <div className="mt-3 h-5 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-16 text-center">
            <p className="text-lg font-extrabold">কোনো কোর্স পাওয়া যায়নি</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              অন্য ফিল্টার চেষ্টা করুন অথবা সব ফিল্টার ক্লিয়ার করুন।
            </p>
            <Link
              to="/courses"
              search={{}}
              className="mt-4 inline-block text-sm font-bold text-brand hover:underline"
            >
              সব ফিল্টার ক্লিয়ার করুন
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: PublicCourseCard }) {
  const cover =
    course.media_items.find((m) => m.type === "image")?.url ?? course.cover_image_url;
  return (
    <Link
      to="/courses/$deptSlug/$semSlug"
      params={{ deptSlug: course.department_slug, semSlug: course.semester_slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100">
        {cover ? (
          <img
            src={cover}
            alt={course.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <GraduationCap className="size-14 text-slate-400/60" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="text-xs font-bold uppercase tracking-wide text-brand">
          {course.department_name} · {course.semester_name}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-base font-extrabold leading-snug">
          {course.title}
        </h3>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" />
            {toBanglaNumber(course.subject_count)} সাব্জেক্ট
          </span>
          <span className="inline-flex items-center gap-1">
            <PlayCircle className="size-3.5" />
            {toBanglaNumber(course.lesson_count)} লেসন
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              শুরু থেকে
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tabular-nums text-foreground">
                ৳{toBanglaNumber(course.price_bdt)}
              </span>
              {course.compare_at_price_bdt && course.compare_at_price_bdt > course.price_bdt && (
                <span className="text-xs text-muted-foreground line-through">
                  ৳{toBanglaNumber(course.compare_at_price_bdt)}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-bold text-foreground group-hover:text-brand">
            বিস্তারিত →
          </span>
        </div>
      </div>
    </Link>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  children,
  search,
}: {
  active?: boolean;
  children: React.ReactNode;
  search: Record<string, unknown>;
}) {
  return (
    <Link
      to="/courses"
      search={search}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-bold transition-all",
        active
          ? "bg-foreground text-background shadow-md"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
      )}
    >
      {children}
    </Link>
  );
}
