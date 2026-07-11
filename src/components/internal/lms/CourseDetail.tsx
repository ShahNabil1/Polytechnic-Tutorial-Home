import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, ArrowLeft, Pencil, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { getCourseByPair, listAcademicTaxonomy } from "@/lib/lms.functions";
import type { AcademicCategory, LmsCourse } from "@/lib/lms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubjectsManager } from "@/components/internal/lms/SubjectsManager";
import { CourseFormDialog } from "@/components/internal/lms/CourseFormDialog";
import { EnrollmentsPanel } from "@/components/internal/lms/EnrollmentsPanel";

type Props = { deptSlug: string; semSlug: string };

export function CourseDetail({ deptSlug, semSlug }: Props) {
  const getFn = useServerFn(getCourseByPair);
  const listTax = useServerFn(listAcademicTaxonomy);

  const [taxonomy, setTaxonomy] = useState<AcademicCategory[]>([]);
  const [course, setCourse] = useState<LmsCourse | null>(null);
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

  async function refetch() {
    setLoading(true);
    try {
      const tax = (await listTax(undefined as never)) as AcademicCategory[];
      setTaxonomy(tax);
      const d = tax.find((t) => t.kind === "department" && t.slug === deptSlug);
      const s = tax.find((t) => t.kind === "semester" && t.slug === semSlug);
      if (d && s) {
        const c = (await getFn({ data: { department_id: d.id, semester_id: s.id } } as never)) as LmsCourse | null;
        setCourse(c);
      } else {
        setCourse(null);
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

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 mb-3">
          Subjects in this course
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
