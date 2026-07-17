import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSubjectBySlug,
  listCurriculum,
  upsertModule,
  deleteModule,
  deleteLesson,
} from "@/lib/lms.functions";
import type { LmsLesson, LmsModuleWithLessons, LmsSubject } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { confirm } from "@/components/ui/confirm-dialog";
import { LessonFormDialog } from "@/components/internal/lms/LessonFormDialog";

export function CurriculumBuilder({ subjectSlug }: { subjectSlug: string }) {
  const getSubject = useServerFn(getSubjectBySlug);
  const listCurr = useServerFn(listCurriculum);
  const upsertMod = useServerFn(upsertModule);
  const deleteMod = useServerFn(deleteModule);
  const deleteLes = useServerFn(deleteLesson);
  const qc = useQueryClient();

  const subjectQ = useQuery({
    queryKey: ["admin", "lms", "subject", subjectSlug],
    queryFn: () => getSubject({ data: { slug: subjectSlug } } as never) as Promise<LmsSubject | null>,
    staleTime: 10 * 60_000,
  });
  const subject = subjectQ.data ?? null;

  const modulesQ = useQuery({
    queryKey: ["admin", "lms", "curriculum", subject?.id ?? "__none"],
    queryFn: () => listCurr({ data: { subject_id: subject!.id } } as never) as Promise<LmsModuleWithLessons[]>,
    enabled: !!subject?.id,
    staleTime: 5 * 60_000,
  });
  const modules = modulesQ.data ?? [];
  const loading = subjectQ.isLoading || modulesQ.isLoading;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [editingModule, setEditingModule] = useState<{ id: string; title: string; description: string } | null>(null);
  const [creatingModule, setCreatingModule] = useState(false);
  const [lessonFormFor, setLessonFormFor] = useState<{ moduleId: string; lesson: LmsLesson | null } | null>(null);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin", "lms"] });
    qc.invalidateQueries({ queryKey: ["lms"] });
  };


  async function handleAddModule() {
    if (!subject || !newModuleTitle.trim()) return;
    setCreatingModule(true);
    try {
      await upsertMod({
        data: {
          patch: {
            subject_id: subject.id,
            title: newModuleTitle.trim(),
            description: null,
            sort_order: modules.length,
          },
        },
      } as never);
      setNewModuleTitle("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create module");
    } finally {
      setCreatingModule(false);
    }
  }

  async function handleSaveModuleEdit() {
    if (!editingModule || !subject) return;
    try {
      await upsertMod({
        data: {
          id: editingModule.id,
          patch: {
            subject_id: subject.id,
            title: editingModule.title.trim(),
            description: editingModule.description.trim() || null,
            sort_order: modules.find((m) => m.id === editingModule.id)?.sort_order ?? 0,
          },
        },
      } as never);
      setEditingModule(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  }

  async function handleDeleteModule(m: LmsModuleWithLessons) {
    if (
      !(await confirm({
        title: `Delete module "${m.title}"?`,
        description: `This removes the module and its ${m.lessons.length} lessons.`,
        variant: "danger",
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await deleteMod({ data: { id: m.id } } as never);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  async function handleDeleteLesson(l: LmsLesson) {
    if (
      !(await confirm({
        title: `Delete lesson "${l.title}"?`,
        variant: "danger",
        confirmLabel: "Delete",
      }))
    )
      return;
    try {
      await deleteLes({ data: { id: l.id } } as never);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
        <p className="text-slate-600">Subject not found.</p>
        <Link to="/workspace/lms-and-courses/subjects" className="text-sm text-indigo-600 underline mt-2 inline-block">
          Back to Subjects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/workspace/lms-and-courses/subjects"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Subjects
      </Link>

      {/* Subject header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/40 backdrop-blur-xl shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 p-6">
          {subject.cover_image_url && (
            <img
              src={subject.cover_image_url}
              alt={subject.name}
              className="w-full md:w-48 aspect-video object-cover rounded-lg border"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h1 className="font-display text-2xl font-bold text-slate-900">{subject.name}</h1>
              {subject.code && <Badge variant="secondary" className="font-mono">{subject.code}</Badge>}
            </div>
            {subject.description && <p className="mt-2 text-sm text-slate-600">{subject.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500">
                {modules.length} module{modules.length !== 1 ? "s" : ""},{" "}
                {modules.reduce((n, m) => n + m.lessons.length, 0)} lesson
                {modules.reduce((n, m) => n + m.lessons.length, 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add module */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <Input
            placeholder="New module title (e.g. Introduction to Calculus)"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddModule()}
          />
          <Button onClick={handleAddModule} disabled={creatingModule || !newModuleTitle.trim()}>
            {creatingModule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="ml-1">Add Module</span>
          </Button>
        </div>
      </div>

      {/* Modules */}
      {modules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          No modules yet. Add your first module above.
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => {
            const isOpen = expanded.has(m.id);
            const isEditing = editingModule?.id === m.id;
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 p-4">
                  <button onClick={() => toggleExpand(m.id)} className="text-slate-400 hover:text-slate-700">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editingModule.title}
                        onChange={(e) => setEditingModule({ ...editingModule, title: e.target.value })}
                      />
                      <Textarea
                        rows={2}
                        placeholder="Module description (optional)"
                        value={editingModule.description}
                        onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveModuleEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingModule(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{m.title}</p>
                        {m.description && <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>}
                      </div>
                      <span className="text-xs text-slate-500">{m.lessons.length} lessons</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setEditingModule({
                            id: m.id,
                            title: m.title,
                            description: m.description ?? "",
                          })
                        }
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteModule(m)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>

                {isOpen && !isEditing && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2">
                    {m.lessons.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-3 rounded-lg bg-white border border-slate-100 p-3"
                      >
                        {l.thumbnail_url ? (
                          <img src={l.thumbnail_url} alt="" className="w-16 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-10 rounded bg-slate-100 flex items-center justify-center">
                            <PlayCircle className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-slate-900 truncate">{l.title}</p>
                            {l.is_free && (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Free
                              </Badge>
                            )}
                          </div>
                          {l.description && (
                            <p className="text-xs text-slate-500 truncate">{l.description}</p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setLessonFormFor({ moduleId: m.id, lesson: l })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteLesson(l)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setLessonFormFor({ moduleId: m.id, lesson: null })}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Lesson
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LessonFormDialog
        open={!!lessonFormFor}
        moduleId={lessonFormFor?.moduleId ?? ""}
        lesson={lessonFormFor?.lesson ?? null}
        onClose={() => setLessonFormFor(null)}
        onSaved={() => {
          setLessonFormFor(null);
          refetch();
        }}
      />
    </div>
  );
}
