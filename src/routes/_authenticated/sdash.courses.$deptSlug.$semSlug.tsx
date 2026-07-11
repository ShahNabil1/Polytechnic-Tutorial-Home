import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import type { CourseMediaItem, LmsCourseContent } from "@/lib/lms";

const SITE_URL = "https://polytechnictutorial.com";

export const Route = createFileRoute("/_authenticated/sdash/courses/$deptSlug/$semSlug")({
  head: ({ params }) => {
    const url = `${SITE_URL}/sdash/courses/${params.deptSlug}/${params.semSlug}`;
    // Loader data isn't populated (component fetches on mount), so we set
    // stable per-URL SEO tags here. Once client renders, richer JSON-LD is
    // still emitted below in the component's <script>.
    return {
      meta: [
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
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
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  async function refetch() {
    setLoading(true);
    try {
      const res = (await fn({
        data: { dept_slug: deptSlug, sem_slug: semSlug },
      } as never)) as LmsCourseContent;
      setData(res);
      setActiveMediaIdx(0);
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

  // Client-side head sync so the tab title / description reflect the loaded
  // course. Server-rendered defaults come from the route head() above.
  useEffect(() => {
    if (!data) return;
    const { course } = data;
    const title = (course.meta_title || course.title || "Course").slice(0, 60);
    const desc = (course.meta_description || course.description || `${title} — enroll now`).slice(0, 160);
    const firstImage = (course.media_items || []).find((m) => m.type === "image")?.url
      ?? course.cover_image_url
      ?? "";
    document.title = title;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    if (firstImage) setMeta("property", "og:image", firstImage);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", desc);
    if (firstImage) setMeta("name", "twitter:image", firstImage);
  }, [data]);

  const heroMedia: CourseMediaItem[] = useMemo(() => {
    if (!data) return [];
    const items = data.course.media_items ?? [];
    if (items.length > 0) return items;
    if (data.course.cover_image_url) {
      return [{ id: "cover", type: "image", url: data.course.cover_image_url }];
    }
    return [];
  }, [data]);

  const jsonLd = useMemo(() => {
    if (!data) return null;
    const { course, department, semester } = data;
    const url = `${SITE_URL}/sdash/courses/${deptSlug}/${semSlug}`;
    const firstImage = heroMedia.find((m) => m.type === "image")?.url;
    return {
      "@context": "https://schema.org",
      "@type": "Course",
      name: course.meta_title || course.title,
      description: course.meta_description || course.description || course.title,
      url,
      ...(firstImage ? { image: firstImage } : {}),
      provider: {
        "@type": "Organization",
        name: "Polytechnic Tutorial",
        sameAs: SITE_URL,
      },
      about: `${department.name} · ${semester.name}`,
      offers: {
        "@type": "Offer",
        price: course.price_bdt,
        priceCurrency: "BDT",
        availability: course.is_active
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url,
      },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "online",
        courseWorkload: `PT${data.subjects.reduce(
          (a, s) => a + s.modules.reduce((b, m) => b + (m.lessons?.length ?? 0), 0),
          0,
        )}H`,
      },
    };
  }, [data, heroMedia, deptSlug, semSlug]);

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
  const activeMedia = heroMedia[activeMediaIdx];

  return (
    <div className="space-y-6">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <Link
        to="/sdash/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> সকল কোর্স
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        {/* Media gallery */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="aspect-video bg-black">
            {activeMedia ? (
              activeMedia.type === "video" ? (
                <video src={activeMedia.url} controls className="w-full h-full" />
              ) : (
                <img
                  src={activeMedia.url}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100">
                <GraduationCap className="w-14 h-14 text-slate-400/60" />
              </div>
            )}
          </div>
          {heroMedia.length > 1 && (
            <div className="flex gap-2 p-2 overflow-x-auto">
              {heroMedia.map((m, idx) => {
                const active = idx === activeMediaIdx;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMediaIdx(idx)}
                    className={`shrink-0 h-16 w-24 rounded-md overflow-hidden border-2 relative ${
                      active ? "border-brand" : "border-transparent hover:border-slate-300"
                    }`}
                  >
                    {m.type === "video" ? (
                      <>
                        <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                        <div className="absolute inset-0 grid place-items-center bg-black/40">
                          <PlayCircle className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Info & CTA */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {department.name} · {semester.name}
          </div>
          <h1 className="text-2xl font-semibold mt-1">{course.title}</h1>
          {course.description && (
            <p className="text-sm text-muted-foreground mt-2">{course.description}</p>
          )}
          <div className="mt-4">
            {has_access ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-1">
                ✓ আপনার এ্যাক্সেস আছে
              </span>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-brand">
                    ৳{course.price_bdt.toLocaleString()}
                  </span>
                  {course.compare_at_price_bdt && course.compare_at_price_bdt > course.price_bdt && (
                    <span className="text-sm text-muted-foreground line-through">
                      ৳{course.compare_at_price_bdt.toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand text-brand-foreground px-4 py-2 text-sm font-medium hover:bg-brand/90 disabled:opacity-60"
                >
                  {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
                  {enrolling ? "প্রসেসিং..." : "Buy Now — এনরোল করুন"}
                </button>
                <div className="text-[11px] text-muted-foreground">
                  (টেস্ট মোড: Paystation gateway এর জায়গায় ইনস্ট্যান্ট এনরোল)
                </div>
              </div>
            )}
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

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
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
