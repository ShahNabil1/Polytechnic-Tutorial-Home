import { Link } from "@tanstack/react-router";
import { BookOpen, PlayCircle, GraduationCap } from "lucide-react";
import type { PublicCourseCard as PublicCourseCardData } from "@/lib/lms.functions";
import { toBanglaNumber } from "@/lib/format";

export function PublicCourseCard({ course }: { course: PublicCourseCardData }) {
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
            loading="lazy"
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
