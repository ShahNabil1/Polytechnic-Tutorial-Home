import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, ArrowLeft, Pencil, GraduationCap, BookOpen, PlayCircle, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { toast } from "sonner";
import { getCourseByPair, listAcademicTaxonomy, listCourseCurriculum } from "@/lib/lms.functions";
import type { AcademicCategory, LmsCourse } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubjectsManager } from "@/components/internal/lms/SubjectsManager";
import { CourseFormDialog } from "@/components/internal/lms/CourseFormDialog";
import { EnrollmentsPanel } from "@/components/internal/lms/EnrollmentsPanel";

type CurriculumSubject = {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  module_count: number;
  lesson_count: number;
  video_count: number;
  modules: Array<{ id: string; title: string; lesson_count: number; video_count: number }>;
};

type Props = { deptSlug: string; semSlug: string };

export function CourseDetail({ deptSlug, semSlug }: Props) {
  const getFn = useServerFn(getCourseByPair);
  const listTax = useServerFn(listAcademicTaxonomy);
  const listCurr = useServerFn(listCourseCurriculum);

  const [taxonomy, setTaxonomy] = useState<AcademicCategory[]>([]);
  const [course, setCourse] = useState<LmsCourse | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSubject[]>([]);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const dept = useMemo(
    () => taxonomy.find((t) => t.kind === "department" && t.slug === deptSlug) ?? null,
    [taxonomy, deptSlug],
  );
  const sem = useMemo(
    () => taxonomy.find((t) => t.kind === "semester" && t.slug === semSlug) ?? null,
    [taxonomy, semSlug],
  );

  const totals = useMemo(() => {
    const subjects = curriculum.length;
    const modules = curriculum.reduce((a, s) => a + s.module_count, 0);
    const lessons = curriculum.reduce((a, s) => a + s.lesson_count, 0);
    const videos = curriculum.reduce((a, s) => a + s.video_count, 0);
    return { subjects, modules, lessons, videos };
  }, [curriculum]);

  async function refetch() {
    setLoading(true);
    try {
      const tax = (await listTax(undefined as never)) as AcademicCategory[];
      setTaxonomy(tax);
      const d = tax.find((t) => t.kind === "department" && t.slug === deptSlug);
      const s = tax.find((t) => t.kind === "semester" && t.slug === semSlug);
      if (d && s) {
        const [c, curr] = await Promise.all([
          getFn({ data: { department_id: d.id, semester_id: s.id } } as never) as Promise<LmsCourse | null>,
          listCurr({ data: { department_id: d.id, semester_id: s.id } } as never) as Promise<CurriculumSubject[]>,
        ]);
        setCourse(c);
        setCurriculum(curr ?? []);
      } else {
        setCourse(null);
        setCurriculum([]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, [deptSlug, semSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!dept || !sem) {
    return (
      <div className="space-y-4">
        <Link to="/workspace/lms-and-courses/courses" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          Department or semester not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/workspace/lms-and-courses/courses" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-4 items-start">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
              {course?.cover_image_url ? (
                <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <GraduationCap className="w-10 h-10 text-slate-400/60" />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{dept.name} · {sem.name}</div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                {course?.title ?? `${dept.name} — ${sem.name}`}
              </h1>
              {course?.description && (
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">{course.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {course ? (
                  <>
                    <span className="text-lg font-bold text-slate-900">৳{course.price_bdt.toLocaleString()}</span>
                    {course.compare_at_price_bdt && course.compare_at_price_bdt > course.price_bdt && (
                      <span className="text-sm text-slate-400 line-through">
                        ৳{course.compare_at_price_bdt.toLocaleString()}
                      </span>
                    )}
                    {!course.is_active && <Badge variant="secondary">Hidden</Badge>}
                  </>
                ) : (
                  <Badge variant="secondary">No course card yet</Badge>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => setEditing(true)} variant="outline">
            <Pencil className="w-4 h-4 mr-1" /> {course ? "Edit course" : "Create course card"}
          </Button>
        </div>
      </div>

      {course && <EnrollmentsPanel courseId={course.id} />}

      {/* Curriculum snapshot — reuses live data from Subjects / Structure */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Curriculum snapshot
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-1 font-medium">
              <BookOpen className="w-3 h-3" /> {totals.subjects} subjects
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 px-2.5 py-1 font-medium">
              <Layers className="w-3 h-3" /> {totals.modules} modules
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 font-medium">
              <PlayCircle className="w-3 h-3" /> {totals.videos} videos
            </span>
          </div>
        </div>
        {curriculum.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-300 rounded-lg">
            No subjects placed in this department + semester yet. Add subjects from the Subjects tab.
          </div>
        ) : (
          <div className="space-y-2">
            {curriculum.map((s) => {
              const open = !!openSubjects[s.id];
              return (
                <div key={s.id} className="rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setOpenSubjects((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                        {s.code && <Badge variant="secondary" className="text-[10px]">{s.code}</Badge>}
                        {!s.is_active && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {s.module_count} modules · {s.lesson_count} lessons · {s.video_count} videos
                      </div>
                    </div>
                    {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </button>
                  {open && (
                    <div className="border-t border-slate-200 bg-slate-50/50 divide-y divide-slate-100">
                      {s.modules.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">No modules yet</div>
                      ) : (
                        s.modules.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="truncate text-slate-800">{m.title}</div>
                            <div className="shrink-0 text-xs text-slate-500 flex gap-3">
                              <span>{m.lesson_count} lessons</span>
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <PlayCircle className="w-3 h-3" /> {m.video_count}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 mb-3">
          Manage subjects in this course
        </h2>
        <SubjectsManager deptFilter={dept.id} semFilter={sem.id} />
      </div>

      <CourseFormDialog
        open={editing}
        course={course}
        taxonomy={taxonomy}
        fixedDeptId={dept.id}
        fixedSemId={sem.id}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          refetch();
        }}
      />
    </div>
  );
}
