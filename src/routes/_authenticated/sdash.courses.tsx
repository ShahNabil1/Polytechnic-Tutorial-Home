import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, GraduationCap, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { listCourseCatalog } from "@/lib/lms.functions";

export const Route = createFileRoute("/_authenticated/sdash/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const listFn = useServerFn(listCourseCatalog);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "mine">("all");

  useEffect(() => {
    (async () => {
      try {
        const data = (await listFn(undefined as never)) as any[];
        setItems(data);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = tab === "mine" ? items.filter((i) => i.has_access) : items;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">কোর্স ক্যাটালগ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী কোর্স ব্রাউজ করুন।
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 rounded-md ${tab === "all" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
          >
            সকল কোর্স
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`px-3 py-1.5 rounded-md ${tab === "mine" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
          >
            আমার কোর্স
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">
            <BookOpen className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">
            {tab === "mine" ? "এখনো কোনো কোর্সে এনরোল হননি" : "কোনো কোর্স পাওয়া যায়নি"}
          </h3>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/sdash/courses/$deptSlug/$semSlug"
              params={{ deptSlug: c.department_slug, semSlug: c.semester_slug }}
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-all"
            >
              <div className="aspect-video bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 relative">
                {c.cover_image_url ? (
                  <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <GraduationCap className="w-12 h-12 text-slate-400/60" />
                  </div>
                )}
                {c.has_access && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-xs px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Enrolled
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {c.department_name} · {c.semester_name}
                </div>
                <h3 className="font-semibold text-base mt-1 line-clamp-2">{c.title}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">{c.subject_count} subjects</div>
                  {c.has_access ? (
                    <span className="text-sm font-medium text-emerald-600">Access ✓</span>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-brand">৳{c.price_bdt.toLocaleString()}</span>
                      {c.compare_at_price_bdt && c.compare_at_price_bdt > c.price_bdt && (
                        <span className="text-xs text-muted-foreground line-through">
                          ৳{c.compare_at_price_bdt.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!c.has_access && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" /> লক করা — এনরোল করুন
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
