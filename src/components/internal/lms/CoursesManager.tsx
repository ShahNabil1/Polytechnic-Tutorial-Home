import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Search, Pencil, Trash2, GraduationCap, Sparkles, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";
import {
  listCourses,
  listAcademicTaxonomy,
  deleteCourse,
  generateMissingCourses,
  setCourseFeatured,
} from "@/lib/lms.functions";
import type { AcademicCategory, LmsCourse } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirm } from "@/components/ui/confirm-dialog";
import { CourseFormDialog } from "@/components/internal/lms/CourseFormDialog";
import { Pagination } from "@/components/internal/Pagination";
import { Switch } from "@/components/ui/switch";

export function CoursesManager() {
  const listFn = useServerFn(listCourses);
  const listTax = useServerFn(listAcademicTaxonomy);
  const deleteFn = useServerFn(deleteCourse);
  const generateFn = useServerFn(generateMissingCourses);
  const featuredFn = useServerFn(setCourseFeatured);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const coursesQ = useQuery({
    queryKey: ["admin", "lms", "courses"],
    queryFn: () => listFn(undefined as never) as Promise<LmsCourse[]>,
    staleTime: 5 * 60_000,
  });
  const taxonomyQ = useQuery({
    queryKey: ["admin", "lms", "structure"],
    queryFn: () => listTax(undefined as never) as Promise<AcademicCategory[]>,
    staleTime: 10 * 60_000,
  });

  const courses = coursesQ.data ?? [];
  const taxonomy = taxonomyQ.data ?? [];
  const loading = coursesQ.isLoading || taxonomyQ.isLoading;

  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [editing, setEditing] = useState<LmsCourse | null>(null);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin", "lms"] });
    qc.invalidateQueries({ queryKey: ["lms"] });
    qc.invalidateQueries({ queryKey: ["courses"] });
  };


  const byId = useMemo(() => new Map(taxonomy.map((t) => [t.id, t])), [taxonomy]);
  const departments = useMemo(
    () => taxonomy.filter((t) => t.kind === "department").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );
  const semesters = useMemo(
    () => taxonomy.filter((t) => t.kind === "semester").sort((a, b) => a.sort_order - b.sort_order),
    [taxonomy],
  );

  const filtered = courses.filter((c) => {
    if (deptFilter && c.department_id !== deptFilter) return false;
    if (semFilter && c.semester_id !== semFilter) return false;
    if (!q.trim()) return true;
    const query = q.toLowerCase();
    return (
      c.title.toLowerCase().includes(query) ||
      (c.description ?? "").toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setPage(1);
  }, [q, deptFilter, semFilter, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);


  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = (await generateFn(undefined as never)) as { created: number };
      toast.success(res.created > 0 ? `Created ${res.created} course(s)` : "All pairs already exist");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(c: LmsCourse) {
    if (
      !(await confirm({
        title: `Delete "${c.title}"?`,
        description: "Removes the course card. Subjects and lessons remain.",
        variant: "danger",
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await deleteFn({ data: { id: c.id } } as never);
      toast.success("Deleted");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  async function handleToggleFeatured(c: LmsCourse, next: boolean) {
    // optimistic
    qc.setQueryData<LmsCourse[]>(["admin", "lms", "courses"], (prev) =>
      (prev ?? []).map((x) => (x.id === c.id ? { ...x, is_featured: next } : x)),
    );
    try {
      await featuredFn({ data: { id: c.id, is_featured: next } } as never);
      toast.success(next ? "Marked as featured" : "Removed from featured");
      refetch();
    } catch (e: any) {
      qc.setQueryData<LmsCourse[]>(["admin", "lms", "courses"], (prev) =>
        (prev ?? []).map((x) => (x.id === c.id ? { ...x, is_featured: !next } : x)),
      );
      toast.error(e?.message ?? "Failed to update");
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Courses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Each course = one department + one semester. Students purchase a course to unlock all its subjects.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Generate missing
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Course
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses..." className="pl-9" />
        </div>
        <div className="w-full sm:w-48">
          <Select value={deptFilter || "__all"} onValueChange={(v) => setDeptFilter(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={semFilter || "__all"} onValueChange={(v) => setSemFilter(v === "__all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All semesters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All semesters</SelectItem>
              {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No courses yet. Click "Generate missing" to create one for every department–semester pair.
        </div>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((c) => {
            const dept = byId.get(c.department_id);
            const sem = byId.get(c.semester_id);
            return (
              <div
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-lg shadow-slate-200/50 transition-all hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 bg-white/60 px-3 py-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <Star
                      className={
                        c.is_featured
                          ? "w-3.5 h-3.5 fill-amber-400 text-amber-500"
                          : "w-3.5 h-3.5 text-slate-400"
                      }
                    />
                    Featured on homepage
                  </label>
                  <Switch
                    checked={c.is_featured}
                    onCheckedChange={(v) => handleToggleFeatured(c, v)}
                  />
                </div>
                <button
                  onClick={() =>
                    navigate({
                      to: "/workspace/lms-and-courses/courses/$deptSlug/$semSlug",
                      params: { deptSlug: dept?.slug ?? "", semSlug: sem?.slug ?? "" },
                    })
                  }
                  className="block w-full text-left"
                >
                  <div className="aspect-[16/9] relative bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 overflow-hidden">
                    {c.cover_image_url ? (
                      <img src={c.cover_image_url} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="w-12 h-12 text-slate-400/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                    {!c.is_active && (
                      <span className="absolute top-2 left-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        Hidden
                      </span>
                    )}
                    <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between text-white">
                      <div className="text-[11px] font-medium drop-shadow">{dept?.name} · {sem?.name}</div>
                      <div className="text-sm font-bold drop-shadow">৳{c.price_bdt.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-slate-900 line-clamp-1">{c.title}</h3>
                    {c.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {c.subject_count} subjects
                      </span>
                      {c.compare_at_price_bdt && c.compare_at_price_bdt > c.price_bdt && (
                        <Badge variant="secondary" className="text-[10px]">
                          Save ৳{(c.compare_at_price_bdt - c.price_bdt).toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 backdrop-blur bg-white/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(c);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 backdrop-blur bg-white/80 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      )}

      <CourseFormDialog
        open={creating || !!editing}
        course={editing}
        taxonomy={taxonomy}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          refetch();
        }}
      />
    </div>
  );
}
