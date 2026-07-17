import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, GraduationCap, CheckCircle2, Lock, Search, PlayCircle, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { listCourseCatalog } from "@/lib/lms.functions";
import { cn } from "@/lib/utils";
import { formatBDT } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sdash/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const listFn = useServerFn(listCourseCatalog);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [query, setQuery] = useState("");
  const [deptSlug, setDeptSlug] = useState<string | null>(null);
  const [semSlug, setSemSlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = (await listFn(undefined as never)) as any[];
        setItems(data);
        if (!data.some((d) => d.has_access)) setTab("all");
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enrolled = useMemo(() => items.filter((i) => i.has_access), [items]);

  const scope = tab === "mine" ? enrolled : items;

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of scope) if (c.department_slug) map.set(c.department_slug, c.department_name);
    return Array.from(map, ([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [scope]);

  const semesters = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of scope) {
      if (deptSlug && c.department_slug !== deptSlug) continue;
      if (c.semester_slug) map.set(c.semester_slug, c.semester_name);
    }
    return Array.from(map, ([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [scope, deptSlug]);

  useEffect(() => {
    if (semSlug && !semesters.some((s) => s.slug === semSlug)) setSemSlug(null);
  }, [semesters, semSlug]);

  const filtered = useMemo(() => {
    let base = scope;
    if (deptSlug) base = base.filter((c) => c.department_slug === deptSlug);
    if (semSlug) base = base.filter((c) => c.semester_slug === semSlug);
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((c) =>
      [c.title, c.slug, c.department_name, c.department_slug, c.semester_name, c.semester_slug, c.description]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)),
    );
  }, [scope, deptSlug, semSlug, query]);

  const hasActiveFilter = Boolean(query.trim() || deptSlug || semSlug);


  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              কোর্স ক্যাটালগ
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              ডিপার্টমেন্ট ও সেমিস্টার অনুযায়ী কোর্স ব্রাউজ করুন এবং এনরোল করুন।
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>
              আমার কোর্স
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-[11px] font-semibold",
                  tab === "mine" ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-600",
                )}
              >
                {enrolled.length}
              </span>
            </TabBtn>
            <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
              সকল কোর্স
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-[11px] font-semibold",
                  tab === "all" ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-600",
                )}
              >
                {items.length}
              </span>
            </TabBtn>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 md:flex-row md:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="search"
              placeholder="কোর্স, ডিপার্টমেন্ট বা সেমিস্টার খুঁজুন..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="ডিপার্টমেন্ট"
              value={deptSlug}
              options={departments}
              onChange={(v) => setDeptSlug(v)}
            />
            <FilterSelect
              label="সেমিস্টার"
              value={semSlug}
              options={semesters}
              onChange={(v) => setSemSlug(v)}
              disabled={semesters.length === 0}
            />
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDeptSlug(null);
                  setSemSlug(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="size-3.5" /> ক্লিয়ার
              </button>
            )}
          </div>
        </div>

        {(deptSlug || semSlug) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            {deptSlug && (
              <FilterChip
                label={departments.find((d) => d.slug === deptSlug)?.name ?? deptSlug}
                onClear={() => setDeptSlug(null)}
              />
            )}
            {semSlug && (
              <FilterChip
                label={semesters.find((s) => s.slug === semSlug)?.name ?? semSlug}
                onClear={() => setSemSlug(null)}
              />
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
            <BookOpen className="size-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {tab === "mine" ? "এখনো কোনো কোর্সে এনরোল হননি" : "কোনো কোর্স পাওয়া যায়নি"}
          </h3>
          {tab === "mine" && (
            <>
              <p className="mt-1 text-sm text-slate-500">সকল কোর্স ট্যাব থেকে কোর্স খুঁজে এনরোল করুন।</p>
              <button
                onClick={() => setTab("all")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
              >
                সকল কোর্স দেখুন
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/sdash/courses/$deptSlug/$semSlug"
              params={{ deptSlug: c.department_slug, semSlug: c.semester_slug }}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-brand/40 hover:shadow-lg"
            >
              <div className="aspect-video bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 relative overflow-hidden">
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
                {c.has_access ? (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-[11px] font-semibold px-2 py-0.5 shadow">
                    <CheckCircle2 className="size-3" /> Enrolled
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-900/70 text-white text-[11px] font-semibold px-2 py-0.5 backdrop-blur">
                    <Lock className="size-3" /> Locked
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {c.department_name} · {c.semester_name}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 line-clamp-2 min-h-[3rem]">
                  {c.title}
                </h3>
                <div className="mt-3 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <PlayCircle className="size-3.5" /> {c.subject_count ?? 0} subjects
                  </div>
                  {c.has_access ? (
                    <span className="text-sm font-semibold text-emerald-600">Continue →</span>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-bold text-brand">
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
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}
