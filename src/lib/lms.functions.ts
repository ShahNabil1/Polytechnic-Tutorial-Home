import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AcademicCategory,
  AcademicKind,
  LmsCourse,
  LmsLesson,
  LmsModule,
  LmsModuleWithLessons,
  LmsSubject,
} from "@/lib/lms";

async function ensureCanManage(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_lms",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: manage_lms required");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || `subject-${Date.now().toString(36)}`;
}

// ==================== Academic Structure (departments/semesters) ====================

function tableForKind(kind: AcademicKind) {
  return kind === "department" ? "lms_departments" : "lms_semesters";
}

export const listAcademicTaxonomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [deps, sems] = await Promise.all([
      context.supabase.from("lms_departments").select("*").order("sort_order"),
      context.supabase.from("lms_semesters").select("*").order("sort_order"),
    ]);
    if (deps.error) throw new Error(deps.error.message);
    if (sems.error) throw new Error(sems.error.message);
    const rows: AcademicCategory[] = [
      ...((deps.data ?? []) as any[]).map((r) => ({
        id: r.id, kind: "department" as const, slug: r.slug, name: r.name,
        sort_order: r.sort_order, is_active: r.is_active,
      })),
      ...((sems.data ?? []) as any[]).map((r) => ({
        id: r.id, kind: "semester" as const, slug: r.slug, name: r.name,
        sort_order: r.sort_order, is_active: r.is_active,
      })),
    ];
    return rows;
  });

const TaxonomyInput = z.object({
  kind: z.enum(["department", "semester"]),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-_]+$/i, "slug: letters, numbers, - or _"),
  name: z.string().trim().min(1).max(120),
  sort_order: z.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export const upsertAcademicTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), patch: TaxonomyInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const table = tableForKind(data.patch.kind);
    const { kind: _k, ...row } = data.patch;
    if (data.id) {
      const { error } = await context.supabase.from(table).update(row as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from(table)
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (inserted as any).id as string };
  });

export const deleteAcademicTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["department", "semester"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from(tableForKind(data.kind)).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== Subjects ====================

async function mapSubjectRow(
  _supabase: any,
  row: any,
  placements: { subject_id: string; department_id: string; semester_id: string }[] = [],
  counts: Map<string, { modules: number; lessons: number }> = new Map(),
): Promise<LmsSubject> {
  const mine = placements.filter((p) => p.subject_id === row.id);
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    slug: row.slug,
    description: row.description ?? null,
    cover_image_url: row.cover_image_url ?? null,
    is_active: row.is_active,
    sort_order: row.sort_order,
    placements: mine.map((p) => ({ department_id: p.department_id, semester_id: p.semester_id })),
    module_count: counts.get(row.id)?.modules ?? 0,
    lesson_count: counts.get(row.id)?.lessons ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("lms_subjects")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [] as LmsSubject[];

    const ids = rows.map((r: any) => r.id);
    const [placeRes, modRes] = await Promise.all([
      context.supabase
        .from("lms_subject_placements")
        .select("subject_id, department_id, semester_id")
        .in("subject_id", ids),
      context.supabase.from("lms_modules").select("id, subject_id").in("subject_id", ids),
    ]);
    if (placeRes.error) throw new Error(placeRes.error.message);
    if (modRes.error) throw new Error(modRes.error.message);

    const placements = (placeRes.data ?? []) as any[];

    const moduleIds = ((modRes.data ?? []) as any[]).map((m) => m.id);
    const counts = new Map<string, { modules: number; lessons: number }>();
    for (const m of (modRes.data ?? []) as any[]) {
      const entry = counts.get(m.subject_id) ?? { modules: 0, lessons: 0 };
      entry.modules += 1;
      counts.set(m.subject_id, entry);
    }
    if (moduleIds.length > 0) {
      const { data: lessons } = await context.supabase
        .from("lms_lessons")
        .select("id, module_id")
        .in("module_id", moduleIds);
      const modToSubject = new Map<string, string>();
      for (const m of (modRes.data ?? []) as any[]) modToSubject.set(m.id, m.subject_id);
      for (const l of (lessons ?? []) as any[]) {
        const sid = modToSubject.get(l.module_id);
        if (!sid) continue;
        const entry = counts.get(sid) ?? { modules: 0, lessons: 0 };
        entry.lessons += 1;
        counts.set(sid, entry);
      }
    }

    return await Promise.all(rows.map((r: any) => mapSubjectRow(context.supabase, r, placements, counts)));
  });

export const getSubjectBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lms_subjects")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { data: placeRows } = await context.supabase
      .from("lms_subject_placements")
      .select("subject_id, department_id, semester_id")
      .eq("subject_id", (row as any).id);
    return await mapSubjectRow(context.supabase, row, (placeRows ?? []) as any[]);
  });


const SubjectInput = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(60).optional().nullable(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/i)
    .optional(),
  description: z.string().max(10000).optional().nullable(),
  cover_image_url: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
  placements: z
    .array(
      z.object({
        department_id: z.string().uuid(),
        semester_id: z.string().uuid(),
      }),
    )
    .max(200)
    .default([]),
});

export const upsertSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), patch: SubjectInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { placements, ...rest } = data.patch;
    const payload: any = {
      name: rest.name,
      code: rest.code?.trim() ? rest.code.trim() : null,
      slug: rest.slug?.trim() || slugify(rest.name),
      description: rest.description ?? null,
      cover_image_url: rest.cover_image_url && rest.cover_image_url !== "" ? rest.cover_image_url : null,
      is_active: rest.is_active,
      sort_order: rest.sort_order,
    };
    let subjectId = data.id;
    if (subjectId) {
      const { error } = await context.supabase
        .from("lms_subjects")
        .update(payload)
        .eq("id", subjectId);
      if (error) throw new Error(error.message);
    } else {
      payload.created_by = context.userId;
      const { data: row, error } = await context.supabase
        .from("lms_subjects")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      subjectId = (row as any).id;
    }
    // reset placements
    await context.supabase.from("lms_subject_placements").delete().eq("subject_id", subjectId!);
    if (placements.length > 0) {
      // Dedupe pairs
      const seen = new Set<string>();
      const rows = placements
        .filter((p) => {
          const k = `${p.department_id}:${p.semester_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((p) => ({
          subject_id: subjectId!,
          department_id: p.department_id,
          semester_id: p.semester_id,
        }));
      const { error } = await context.supabase.from("lms_subject_placements").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: subjectId! };
  });


export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("lms_subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== Curriculum: modules + lessons ====================

export const listCurriculum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ subject_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: modules, error } = await context.supabase
      .from("lms_modules")
      .select("*")
      .eq("subject_id", data.subject_id)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    const moduleIds = ((modules ?? []) as any[]).map((m) => m.id);
    let lessons: LmsLesson[] = [];
    if (moduleIds.length > 0) {
      const { data: lessonRows, error: lErr } = await context.supabase
        .from("lms_lessons")
        .select("*")
        .in("module_id", moduleIds)
        .order("sort_order")
        .order("created_at");
      if (lErr) throw new Error(lErr.message);
      lessons = (lessonRows ?? []) as LmsLesson[];
    }
    const byModule = new Map<string, LmsLesson[]>();
    for (const l of lessons) {
      const arr = byModule.get(l.module_id) ?? [];
      arr.push(l);
      byModule.set(l.module_id, arr);
    }
    return ((modules ?? []) as LmsModule[]).map((m) => ({
      ...m,
      lessons: byModule.get(m.id) ?? [],
    })) as LmsModuleWithLessons[];
  });

const ModuleInput = z.object({
  subject_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), patch: ModuleInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("lms_modules")
        .update(data.patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("lms_modules")
      .insert(data.patch as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any).id as string };
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("lms_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const LessonInput = z.object({
  module_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  video_url: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  video_provider: z.enum(["r2", "youtube", "vimeo", "external"]).default("r2"),
  thumbnail_url: z.string().trim().max(1000).optional().nullable().or(z.literal("")),
  duration_seconds: z.number().int().min(0).max(86400).optional().nullable(),
  is_free: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().optional(), patch: LessonInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const patch: any = {
      ...data.patch,
      video_url: data.patch.video_url ? data.patch.video_url : null,
      thumbnail_url: data.patch.thumbnail_url ? data.patch.thumbnail_url : null,
      description: data.patch.description ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("lms_lessons").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("lms_lessons")
      .insert(patch)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any).id as string };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("lms_lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
