import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Search, Pencil, Trash2, BookOpen, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listSubjects,
  deleteSubject,
  listAcademicTaxonomy,
} from "@/lib/lms.functions";
import type { AcademicCategory, LmsSubject } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { confirm } from "@/components/ui/confirm-dialog";
import { SubjectFormDialog } from "@/components/internal/lms/SubjectFormDialog";

export function SubjectsManager() {
  const listFn = useServerFn(listSubjects);
  const listTax = useServerFn(listAcademicTaxonomy);
  const deleteFn = useServerFn(deleteSubject);
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<LmsSubject[]>([]);
  const [taxonomy, setTaxonomy] = useState<AcademicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editSubject, setEditSubject] = useState<LmsSubject | null>(null);
  const [creating, setCreating] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        listFn(undefined as never) as Promise<LmsSubject[]>,
        listTax(undefined as never) as Promise<AcademicCategory[]>,
      ]);
      setSubjects(s);
      setTaxonomy(t);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const taxonomyById = useMemo(() => new Map(taxonomy.map((t) => [t.id, t])), [taxonomy]);

  const filtered = subjects.filter((s) => {
    if (!q.trim()) return true;
    const query = q.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      (s.code ?? "").toLowerCase().includes(query) ||
      (s.description ?? "").toLowerCase().includes(query)
    );
  });

  async function handleDelete(subject: LmsSubject) {
    if (
      !(await confirm({
        title: `Delete "${subject.name}"?`,
        description: "This will remove the subject and all its modules and lessons.",
        variant: "danger",
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await deleteFn({ data: { id: subject.id } } as never);
      toast.success("Deleted");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Subjects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Subjects shared across multiple departments and semesters.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Subject
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search subjects..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No subjects yet. Click "Add Subject" to create one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const depts = s.department_ids.map((id) => taxonomyById.get(id)).filter(Boolean) as AcademicCategory[];
            const sems = s.semester_ids.map((id) => taxonomyById.get(id)).filter(Boolean) as AcademicCategory[];
            return (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-lg shadow-slate-200/50 transition-all hover:shadow-2xl hover:-translate-y-0.5"
              >
                <button
                  onClick={() => navigate({ to: "/workspace/lms-and-courses/curriculum/$subjectSlug", params: { subjectSlug: s.slug } })}
                  className="block w-full text-left"
                >
                  <div className="aspect-[16/9] relative bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 overflow-hidden">
                    {s.cover_image_url ? (
                      <img src={s.cover_image_url} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-slate-400/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
                    {!s.is_active && (
                      <span className="absolute top-2 left-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 line-clamp-1">{s.name}</h3>
                      {s.code && (
                        <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                          {s.code}
                        </Badge>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {depts.map((d) => (
                        <span
                          key={d.id}
                          className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                        >
                          {d.name}
                        </span>
                      ))}
                      {sems.map((se) => (
                        <span
                          key={se.id}
                          className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                        >
                          {se.name}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> {s.module_count} modules
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" /> {s.lesson_count} lessons
                      </span>
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
                      setEditSubject(s);
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
                      handleDelete(s);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SubjectFormDialog
        open={creating || !!editSubject}
        subject={editSubject}
        taxonomy={taxonomy}
        onClose={() => {
          setCreating(false);
          setEditSubject(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditSubject(null);
          refetch();
        }}
      />
    </div>
  );
}
