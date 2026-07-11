import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Loader2,
  Lock,
  PlayCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { getCourseContentForUser, enrollInCourseTest } from "@/lib/lms.functions";
import type { LmsCourseContent } from "@/lib/lms";

export const Route = createFileRoute("/_authenticated/sdash/courses/$deptSlug/$semSlug")({
  component: StudentCourseView,
});

function StudentCourseView() {
  const { deptSlug, semSlug } = useParams({ strict: false }) as {
    deptSlug: string;
    semSlug: string;
  };
  const fn = useServerFn(getCourseContentForUser);
  const enrollFn = useServerFn(enrollInCourseTest);
  const [data, setData] = useState<LmsCourseContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [activeLesson, setActiveLesson] = useState<any | null>(null);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});

  async function refetch() {
    setLoading(true);
    try {
      const res = (await fn({
        data: { dept_slug: deptSlug, sem_slug: semSlug },
      } as never)) as LmsCourseContent;
      setData(res);
      if (res.subjects[0]) setOpenSubjects((p) => (Object.keys(p).length ? p : { [res.subjects[0].id]: true }));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    if (!data) return;
    setEnrolling(true);
    try {
      await enrollFn({ data: { course_id: data.course.id } } as never);
      toast.success("এনরোলমেন্ট সফল! কোর্সে এ্যাক্সেস পেয়েছেন।");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "এনরোল ব্যর্থ হয়েছে");
    } finally {
      setEnrolling(false);
    }
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptSlug, semSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return <div className="py-16 text-center text-muted-foreground">Not found</div>;
  }

  const { course, department, semester, has_access, subjects } = data;

  return (
    <div className="space-y-6">
      <Link
        to="/sdash/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> সকল কোর্স
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 grid place-items-center shrink-0">
            {course.cover_image_url ? (
              <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-10 h-10 text-slate-400/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {department.name} · {semester.name}
            </div>
            <h1 className="text-2xl font-semibold mt-0.5">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-muted-foreground mt-1">{course.description}</p>
            )}
            <div className="mt-3">
              {has_access ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-1">
                  ✓ আপনার এ্যাক্সেস আছে
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-brand">
                    ৳{course.price_bdt.toLocaleString()}
                  </span>
                  {course.compare_at_price_bdt && course.compare_at_price_bdt > course.price_bdt && (
                    <span className="text-sm text-muted-foreground line-through">
                      ৳{course.compare_at_price_bdt.toLocaleString()}
                    </span>
                  )}
                  <button className="rounded-lg bg-brand text-brand-foreground px-4 py-2 text-sm font-medium hover:bg-brand/90">
                    এনরোল করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Video / preview */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {activeLesson ? (
            <div>
              <div className="aspect-video bg-black">
                {activeLesson.video_url ? (
                  activeLesson.video_provider === "youtube" ? (
                    <iframe
                      className="w-full h-full"
                      src={toEmbedUrl(activeLesson.video_url, "youtube")}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : activeLesson.video_provider === "vimeo" ? (
                    <iframe
                      className="w-full h-full"
                      src={toEmbedUrl(activeLesson.video_url, "vimeo")}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  ) : (
                    <video src={activeLesson.video_url} controls className="w-full h-full" />
                  )
                ) : (
                  <div className="w-full h-full grid place-items-center text-white/80">
                    <div className="text-center">
                      <Lock className="w-10 h-10 mx-auto mb-2" />
                      <div>এই লেসন এনরোল করার পর দেখা যাবে</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{activeLesson.title}</h3>
                {activeLesson.description && (
                  <p className="text-sm text-muted-foreground mt-1">{activeLesson.description}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-secondary grid place-items-center text-muted-foreground">
              <div className="text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-2" />
                <div>একটি লেসন বাছাই করুন</div>
              </div>
            </div>
          )}
        </div>

        {/* Curriculum */}
        <aside className="rounded-2xl border border-border bg-card p-3 max-h-[720px] overflow-y-auto">
          <h3 className="font-semibold px-2 py-2">কারিকুলাম</h3>
          {subjects.length === 0 ? (
            <div className="text-sm text-muted-foreground px-2 py-4">কোনো সাব্জেক্ট নেই</div>
          ) : (
            <div className="space-y-1">
              {subjects.map((s) => {
                const open = !!openSubjects[s.id];
                const totalLessons = s.modules.reduce((a, m) => a + m.lessons.length, 0);
                return (
                  <div key={s.id} className="rounded-lg">
                    <button
                      onClick={() => setOpenSubjects((p) => ({ ...p, [s.id]: !p[s.id] }))}
                      className="w-full flex items-center justify-between px-2 py-2 hover:bg-secondary rounded-md text-left"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.modules.length} module · {totalLessons} lesson
                        </div>
                      </div>
                      {open ? (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                    {open && (
                      <div className="pl-3 border-l border-border ml-3 space-y-2 py-1">
                        {s.modules.map((m) => (
                          <div key={m.id}>
                            <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                              {m.title}
                            </div>
                            {m.lessons.map((l: any) => {
                              const locked = !has_access && !l.is_free;
                              const isActive = activeLesson?.id === l.id;
                              return (
                                <button
                                  key={l.id}
                                  onClick={() => setActiveLesson(l)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-secondary ${
                                    isActive ? "bg-secondary" : ""
                                  }`}
                                >
                                  {locked ? (
                                    <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  ) : (
                                    <PlayCircle className="w-3.5 h-3.5 text-brand shrink-0" />
                                  )}
                                  <span className="truncate">{l.title}</span>
                                  {l.is_free && (
                                    <span className="ml-auto text-[10px] uppercase text-emerald-600">
                                      free
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                        {s.modules.length === 0 && (
                          <div className="text-xs text-muted-foreground px-2 py-1">
                            কোনো মডিউল নেই
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function toEmbedUrl(url: string, provider: "youtube" | "vimeo"): string {
  try {
    if (provider === "youtube") {
      const u = new URL(url);
      const id =
        u.searchParams.get("v") ||
        u.pathname.split("/").filter(Boolean).pop() ||
        "";
      return `https://www.youtube.com/embed/${id}`;
    }
    if (provider === "vimeo") {
      const id = url.split("/").filter(Boolean).pop() || "";
      return `https://player.vimeo.com/video/${id}`;
    }
  } catch {}
  return url;
}
