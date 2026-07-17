import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function serverPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}
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

const LMS_PUBLIC_TTL = 30 * 60; // 30 min

async function invalidateLmsCaches() {
  const { cacheDelPrefix } = await import("./cache.server");
  await cacheDelPrefix("lms:public:");
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

// ==================== Courses (Department × Semester) ====================

function toCourseRow(row: any, subjectCount = 0): LmsCourse {
  const media = Array.isArray(row.media_items) ? (row.media_items as any[]) : [];
  return {
    id: row.id,
    department_id: row.department_id,
    semester_id: row.semester_id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    cover_image_url: row.cover_image_url ?? null,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
    media_items: media.map((m: any) => ({
      id: String(m.id ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      type: m.type === "video" ? "video" : "image",
      url: String(m.url ?? ""),
      alt: m.alt ?? null,
    })),
    price_bdt: Number(row.price_bdt ?? 0),
    compare_at_price_bdt: row.compare_at_price_bdt != null ? Number(row.compare_at_price_bdt) : null,
    is_active: row.is_active,
    is_featured: !!row.is_featured,
    sort_order: row.sort_order,
    subject_count: subjectCount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("lms_courses")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    if (list.length === 0) return [] as LmsCourse[];

    // Subject count per (dept, sem) via placements
    const { data: placeRows, error: pErr } = await context.supabase
      .from("lms_subject_placements")
      .select("department_id, semester_id, subject_id");
    if (pErr) throw new Error(pErr.message);

    const key = (d: string, s: string) => `${d}:${s}`;
    const counts = new Map<string, Set<string>>();
    for (const p of (placeRows ?? []) as any[]) {
      const k = key(p.department_id, p.semester_id);
      const set = counts.get(k) ?? new Set<string>();
      set.add(p.subject_id);
      counts.set(k, set);
    }
    return list.map((r) => toCourseRow(r, counts.get(key(r.department_id, r.semester_id))?.size ?? 0));
  });

export const getCourseByPair = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ department_id: z.string().uuid(), semester_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lms_courses")
      .select("*")
      .eq("department_id", data.department_id)
      .eq("semester_id", data.semester_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return toCourseRow(row);
  });

const MediaItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "video"]),
  url: z.string().url().max(1000),
  alt: z.string().max(300).optional().nullable(),
});

const CoursePatch = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/i)
    .optional(),
  description: z.string().max(10000).optional().nullable(),
  cover_image_url: z.string().url().max(1000).optional().nullable().or(z.literal("")),
  meta_title: z.string().max(200).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
  media_items: z
    .array(MediaItemSchema)
    .max(6)
    .default([])
    .refine(
      (arr) => arr.filter((m) => m.type === "image").length <= 5,
      { message: "Maximum 5 images allowed" },
    )
    .refine(
      (arr) => arr.filter((m) => m.type === "video").length <= 1,
      { message: "Only 1 video allowed" },
    ),
  price_bdt: z.number().min(0).max(1_000_000).default(0),
  compare_at_price_bdt: z.number().min(0).max(1_000_000).optional().nullable(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        department_id: z.string().uuid(),
        semester_id: z.string().uuid(),
        patch: CoursePatch,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const media = data.patch.media_items ?? [];
    const firstImage = media.find((m) => m.type === "image");
    const payload: any = {
      department_id: data.department_id,
      semester_id: data.semester_id,
      title: data.patch.title.trim(),
      slug: data.patch.slug?.trim() || slugify(data.patch.title),
      description: data.patch.description ?? null,
      cover_image_url:
        firstImage?.url ||
        (data.patch.cover_image_url && data.patch.cover_image_url !== ""
          ? data.patch.cover_image_url
          : null),
      meta_title: data.patch.meta_title?.trim() || null,
      meta_description: data.patch.meta_description?.trim() || null,
      media_items: media,
      price_bdt: data.patch.price_bdt,
      compare_at_price_bdt: data.patch.compare_at_price_bdt ?? null,
      is_active: data.patch.is_active,
      is_featured: data.patch.is_featured,
      sort_order: data.patch.sort_order,
    };
    if (data.id) {
      const { error } = await context.supabase.from("lms_courses").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    payload.created_by = context.userId;
    const { data: row, error } = await context.supabase
      .from("lms_courses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any).id as string };
  });

export const setCourseFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), is_featured: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase
      .from("lms_courses")
      .update({ is_featured: data.is_featured })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("lms_courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-generate a course row for every (dept × sem) pair missing one.
export const generateMissingCourses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManage(context);
    const [depsRes, semsRes, coursesRes] = await Promise.all([
      context.supabase.from("lms_departments").select("id, name, slug").eq("is_active", true),
      context.supabase.from("lms_semesters").select("id, name, slug").eq("is_active", true),
      context.supabase.from("lms_courses").select("department_id, semester_id"),
    ]);
    if (depsRes.error) throw new Error(depsRes.error.message);
    if (semsRes.error) throw new Error(semsRes.error.message);
    if (coursesRes.error) throw new Error(coursesRes.error.message);

    const existing = new Set(
      ((coursesRes.data ?? []) as any[]).map((c) => `${c.department_id}:${c.semester_id}`),
    );
    const rows: any[] = [];
    for (const d of (depsRes.data ?? []) as any[]) {
      for (const s of (semsRes.data ?? []) as any[]) {
        if (existing.has(`${d.id}:${s.id}`)) continue;
        const baseSlug = slugify(`${d.slug}-${s.slug}`);
        rows.push({
          department_id: d.id,
          semester_id: s.id,
          title: `${d.name} — ${s.name}`,
          slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
          price_bdt: 0,
          is_active: true,
          created_by: context.userId,
        });
      }
    }
    if (rows.length === 0) return { ok: true, created: 0 };
    const { error } = await context.supabase.from("lms_courses").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, created: rows.length };
  });


// ==================== Enrollments & Student Catalog ====================

export const listCourseCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [coursesRes, depsRes, semsRes, enrolRes] = await Promise.all([
      context.supabase
        .from("lms_courses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false }),
      context.supabase.from("lms_departments").select("id, name, slug"),
      context.supabase.from("lms_semesters").select("id, name, slug"),
      context.supabase
        .from("lms_enrollments")
        .select("course_id, expires_at")
        .eq("user_id", context.userId),
    ]);
    if (coursesRes.error) throw new Error(coursesRes.error.message);
    if (depsRes.error) throw new Error(depsRes.error.message);
    if (semsRes.error) throw new Error(semsRes.error.message);
    if (enrolRes.error) throw new Error(enrolRes.error.message);

    const depMap = new Map<string, any>(((depsRes.data ?? []) as any[]).map((d) => [d.id, d]));
    const semMap = new Map<string, any>(((semsRes.data ?? []) as any[]).map((s) => [s.id, s]));
    const now = Date.now();
    const accessSet = new Set<string>(
      ((enrolRes.data ?? []) as any[])
        .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)
        .map((e) => e.course_id),
    );

    // subject counts
    const { data: placeRows } = await context.supabase
      .from("lms_subject_placements")
      .select("department_id, semester_id, subject_id");
    const counts = new Map<string, Set<string>>();
    for (const p of (placeRows ?? []) as any[]) {
      const k = `${p.department_id}:${p.semester_id}`;
      const set = counts.get(k) ?? new Set<string>();
      set.add(p.subject_id);
      counts.set(k, set);
    }

    return ((coursesRes.data ?? []) as any[])
      .map((r) => {
        const dep = depMap.get(r.department_id);
        const sem = semMap.get(r.semester_id);
        if (!dep || !sem) return null;
        const media = Array.isArray(r.media_items) ? (r.media_items as any[]) : [];
        return {
          id: r.id,
          department_id: r.department_id,
          semester_id: r.semester_id,
          title: r.title,
          slug: r.slug,
          description: r.description,
          cover_image_url: r.cover_image_url,
          meta_title: r.meta_title ?? null,
          meta_description: r.meta_description ?? null,
          media_items: media,
          price_bdt: Number(r.price_bdt ?? 0),
          compare_at_price_bdt:
            r.compare_at_price_bdt == null ? null : Number(r.compare_at_price_bdt),
          is_active: r.is_active,
          sort_order: r.sort_order,
          subject_count: counts.get(`${r.department_id}:${r.semester_id}`)?.size ?? 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
          department_name: dep.name,
          department_slug: dep.slug,
          semester_name: sem.name,
          semester_slug: sem.slug,
          has_access: accessSet.has(r.id),
        };
      })
      .filter(Boolean);
  });

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lms_enrollments")
      .select("*, course:lms_courses(*)")
      .eq("user_id", context.userId)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getStudentDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [enrolRes, depsRes, semsRes, placeRes] = await Promise.all([
      context.supabase
        .from("lms_enrollments")
        .select("id, course_id, granted_at, expires_at, order_id, course:lms_courses(*)")
        .eq("user_id", context.userId)
        .order("granted_at", { ascending: false }),
      context.supabase.from("lms_departments").select("id, name, slug"),
      context.supabase.from("lms_semesters").select("id, name, slug"),
      context.supabase.from("lms_subject_placements").select("department_id, semester_id, subject_id"),
    ]);
    if (enrolRes.error) throw new Error(enrolRes.error.message);
    if (depsRes.error) throw new Error(depsRes.error.message);
    if (semsRes.error) throw new Error(semsRes.error.message);

    const depMap = new Map<string, any>(((depsRes.data ?? []) as any[]).map((d) => [d.id, d]));
    const semMap = new Map<string, any>(((semsRes.data ?? []) as any[]).map((s) => [s.id, s]));
    const subjectCounts = new Map<string, Set<string>>();
    for (const p of (placeRes.data ?? []) as any[]) {
      const k = `${p.department_id}:${p.semester_id}`;
      const set = subjectCounts.get(k) ?? new Set<string>();
      set.add(p.subject_id);
      subjectCounts.set(k, set);
    }

    const now = Date.now();
    const enrollments = ((enrolRes.data ?? []) as any[])
      .filter((e) => e.course)
      .map((e) => {
        const c = e.course as any;
        const dep = depMap.get(c.department_id);
        const sem = semMap.get(c.semester_id);
        const expired = e.expires_at ? new Date(e.expires_at).getTime() <= now : false;
        return {
          enrollment_id: e.id as string,
          granted_at: e.granted_at as string,
          expires_at: e.expires_at as string | null,
          expired,
          order_id: e.order_id as string | null,
          course: {
            id: c.id,
            title: c.title,
            slug: c.slug,
            cover_image_url: c.cover_image_url,
            price_bdt: Number(c.price_bdt ?? 0),
            department_id: c.department_id,
            semester_id: c.semester_id,
            department_name: dep?.name ?? "",
            department_slug: dep?.slug ?? "",
            semester_name: sem?.name ?? "",
            semester_slug: sem?.slug ?? "",
            subject_count: subjectCounts.get(`${c.department_id}:${c.semester_id}`)?.size ?? 0,
          },
        };
      });

    return { enrollments };
  });

export const getCourseContentForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ dept_slug: z.string(), sem_slug: z.string() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const [depRes, semRes] = await Promise.all([
      context.supabase.from("lms_departments").select("*").eq("slug", data.dept_slug).maybeSingle(),
      context.supabase.from("lms_semesters").select("*").eq("slug", data.sem_slug).maybeSingle(),
    ]);
    if (depRes.error) throw new Error(depRes.error.message);
    if (semRes.error) throw new Error(semRes.error.message);
    const dep = depRes.data as any;
    const sem = semRes.data as any;
    if (!dep || !sem) throw new Error("Course not found");

    const { data: courseRow, error: cErr } = await context.supabase
      .from("lms_courses")
      .select("*")
      .eq("department_id", dep.id)
      .eq("semester_id", sem.id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!courseRow) throw new Error("Course not found");

    const accessRes = await context.supabase.rpc("has_course_access", {
      _user_id: context.userId,
      _course_id: (courseRow as any).id,
    });
    const hasAccess = accessRes.data === true;

    // Subjects placed in this (dept,sem)
    const { data: placements, error: pErr } = await context.supabase
      .from("lms_subject_placements")
      .select("subject_id")
      .eq("department_id", dep.id)
      .eq("semester_id", sem.id);
    if (pErr) throw new Error(pErr.message);
    const subjectIds = ((placements ?? []) as any[]).map((p) => p.subject_id);

    let subjects: any[] = [];
    if (subjectIds.length > 0) {
      const { data: subjRows, error: sErr } = await context.supabase
        .from("lms_subjects")
        .select("*")
        .in("id", subjectIds)
        .eq("is_active", true)
        .order("sort_order");
      if (sErr) throw new Error(sErr.message);
      subjects = (subjRows ?? []) as any[];
    }

    // Load modules + lessons
    const subjectIdList = subjects.map((s) => s.id);
    const modulesBySubject = new Map<string, any[]>();
    const lessonsByModule = new Map<string, any[]>();
    if (subjectIdList.length > 0) {
      const { data: modRows } = await context.supabase
        .from("lms_modules")
        .select("*")
        .in("subject_id", subjectIdList)
        .order("sort_order");
      const mods = (modRows ?? []) as any[];
      for (const m of mods) {
        const arr = modulesBySubject.get(m.subject_id) ?? [];
        arr.push(m);
        modulesBySubject.set(m.subject_id, arr);
      }
      const moduleIds = mods.map((m) => m.id);
      if (moduleIds.length > 0) {
        const { data: lessonRows } = await context.supabase
          .from("lms_lessons")
          .select("*")
          .in("module_id", moduleIds)
          .order("sort_order");
        for (const l of (lessonRows ?? []) as any[]) {
          const arr = lessonsByModule.get(l.module_id) ?? [];
          // Strip video url if no access and lesson isn't free
          if (!hasAccess && !l.is_free) {
            arr.push({ ...l, video_url: null });
          } else {
            arr.push(l);
          }
          lessonsByModule.set(l.module_id, arr);
        }
      }
    }

    const courseMedia = Array.isArray((courseRow as any).media_items)
      ? ((courseRow as any).media_items as any[])
      : [];
    return {
      course: {
        id: (courseRow as any).id,
        department_id: (courseRow as any).department_id,
        semester_id: (courseRow as any).semester_id,
        title: (courseRow as any).title,
        slug: (courseRow as any).slug,
        description: (courseRow as any).description,
        cover_image_url: (courseRow as any).cover_image_url,
        meta_title: (courseRow as any).meta_title ?? null,
        meta_description: (courseRow as any).meta_description ?? null,
        media_items: courseMedia,
        price_bdt: Number((courseRow as any).price_bdt ?? 0),
        compare_at_price_bdt:
          (courseRow as any).compare_at_price_bdt == null
            ? null
            : Number((courseRow as any).compare_at_price_bdt),
        is_active: (courseRow as any).is_active,
        sort_order: (courseRow as any).sort_order,
        created_at: (courseRow as any).created_at,
        updated_at: (courseRow as any).updated_at,
      },
      department: {
        id: dep.id,
        kind: "department",
        slug: dep.slug,
        name: dep.name,
        sort_order: dep.sort_order,
        is_active: dep.is_active,
      },
      semester: {
        id: sem.id,
        kind: "semester",
        slug: sem.slug,
        name: sem.name,
        sort_order: sem.sort_order,
        is_active: sem.is_active,
      },
      has_access: hasAccess,
      subjects: subjects.map((s) => ({
        ...s,
        modules: (modulesBySubject.get(s.id) ?? []).map((m) => ({
          ...m,
          lessons: lessonsByModule.get(m.id) ?? [],
        })),
      })),
    };
  });

// ---------- Admin enrollment management ----------

export const listCourseEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ course_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { data: rows, error } = await context.supabase
      .from("lms_enrollments")
      .select("*")
      .eq("course_id", data.course_id)
      .order("granted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.user_id)));
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      profileMap = new Map(((profs ?? []) as any[]).map((p) => [p.id, p]));
    }
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      user_email: profileMap.get(r.user_id)?.email ?? null,
      user_full_name: profileMap.get(r.user_id)?.full_name ?? null,
    }));
  });

export const grantEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        course_id: z.string().uuid(),
        email: z.string().email(),
        expires_at: z.string().optional().nullable(),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { data: prof, error: pErr } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof) throw new Error("No user found with that email");
    const { error } = await context.supabase.from("lms_enrollments").upsert(
      {
        user_id: (prof as any).id,
        course_id: data.course_id,
        granted_by: context.userId,
        expires_at: data.expires_at || null,
        note: data.note || null,
      } as never,
      { onConflict: "user_id,course_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("lms_enrollments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== Test-mode instant enroll ====================
// TEMPORARY: Simulates a successful Paystation payment by inserting an
// enrollment directly. Only students can call this on their own behalf.

export const enrollInCourseTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        course_id: z.string().uuid(),
        coupon_code: z.string().trim().min(1).max(60).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isStudent, error: rErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "student",
    });
    if (rErr) throw new Error(rErr.message);
    if (isStudent !== true) {
      throw new Error("শুধু স্টুডেন্ট রোলের ইউজার এনরোল করতে পারবে।");
    }

    const { data: course, error: cErr } = await context.supabase
      .from("lms_courses")
      .select("id, is_active, price_bdt")
      .eq("id", data.course_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course || !(course as any).is_active) {
      throw new Error("এই কোর্সটি এখন উপলব্ধ নয়।");
    }

    // Optional coupon validation. In test-mode we don't process real payment,
    // so we just re-validate against the coupons RPC and record the code +
    // discount amount in the enrollment note for CRM/audit purposes. A bad
    // coupon rejects the enrollment so the client can retry without it.
    let note = "test-mode: instant enroll (Paystation stub)";
    if (data.coupon_code) {
      const subtotal = Number((course as any).price_bdt ?? 0);
      const { data: res, error: vErr } = await context.supabase.rpc("validate_coupon", {
        _code: data.coupon_code,
        _subtotal: subtotal,
        _product_ids: [] as string[],
        _category_ids: [data.course_id],
        _phone: null,
        _user_id: context.userId,
        _scope: "course",
      } as any);
      if (vErr) throw new Error(vErr.message);
      const r = (res ?? {}) as any;
      if (!r.ok) {
        throw new Error(
          r.reason === "min_spend"
            ? "কুপন প্রয়োগ করা যাচ্ছে না (মিনিমাম স্পেন্ড পূরণ হয়নি)।"
            : "কুপন অবৈধ বা মেয়াদোত্তীর্ণ।",
        );
      }
      note = `test-mode enroll · coupon=${r.code} · discount=৳${Number(r.discount ?? 0)}`;
    }

    const { error } = await context.supabase.from("lms_enrollments").upsert(
      {
        user_id: context.userId,
        course_id: data.course_id,
        granted_by: context.userId,
        note,
      } as never,
      { onConflict: "user_id,course_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ==================== Course curriculum snapshot (admin) ====================
// Returns the subjects placed in a course's (dept, sem) pair with modules
// and lesson (video) counts — reuses the same tables Subjects / Structure use.

export const listCourseCurriculum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ department_id: z.string().uuid(), semester_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: placeRows, error: pErr } = await context.supabase
      .from("lms_subject_placements")
      .select("subject_id")
      .eq("department_id", data.department_id)
      .eq("semester_id", data.semester_id);
    if (pErr) throw new Error(pErr.message);
    const subjectIds = ((placeRows ?? []) as any[]).map((p) => p.subject_id);
    if (subjectIds.length === 0) return [] as any[];

    const { data: subjRows, error: sErr } = await context.supabase
      .from("lms_subjects")
      .select("id, name, code, slug, description, cover_image_url, is_active, sort_order")
      .in("id", subjectIds)
      .order("sort_order");
    if (sErr) throw new Error(sErr.message);
    const subjects = (subjRows ?? []) as any[];

    const { data: modRows } = await context.supabase
      .from("lms_modules")
      .select("id, subject_id, title, sort_order")
      .in("subject_id", subjectIds)
      .order("sort_order");
    const modules = (modRows ?? []) as any[];
    const moduleIds = modules.map((m) => m.id);

    const lessonCountByModule = new Map<string, number>();
    let lessonsByModule = new Map<string, number>();
    if (moduleIds.length > 0) {
      const { data: lessonRows } = await context.supabase
        .from("lms_lessons")
        .select("id, module_id, video_url")
        .in("module_id", moduleIds);
      for (const l of (lessonRows ?? []) as any[]) {
        lessonCountByModule.set(l.module_id, (lessonCountByModule.get(l.module_id) ?? 0) + 1);
        if (l.video_url && l.video_url !== "") {
          lessonsByModule.set(l.module_id, (lessonsByModule.get(l.module_id) ?? 0) + 1);
        }
      }
    }

    const modulesBySubject = new Map<string, any[]>();
    for (const m of modules) {
      const arr = modulesBySubject.get(m.subject_id) ?? [];
      arr.push({
        id: m.id,
        title: m.title,
        sort_order: m.sort_order,
        lesson_count: lessonCountByModule.get(m.id) ?? 0,
        video_count: lessonsByModule.get(m.id) ?? 0,
      });
      modulesBySubject.set(m.subject_id, arr);
    }

    return subjects.map((s) => {
      const mods = modulesBySubject.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        slug: s.slug,
        is_active: s.is_active,
        module_count: mods.length,
        lesson_count: mods.reduce((a, m) => a + m.lesson_count, 0),
        video_count: mods.reduce((a, m) => a + m.video_count, 0),
        modules: mods,
      };
    });
  });


// ==================== Public (anon) course catalog ====================
// These use a publishable-key client so they run for signed-out visitors
// on `/courses` and `/courses/$deptSlug/$semSlug`. Public row visibility is
// enforced by the `is_active` policies on lms_courses, lms_departments,
// lms_semesters, lms_subjects, lms_modules, lms_lessons and the anon
// SELECT policy on lms_subject_placements.

export type PublicCourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  media_items: { id: string; type: "image" | "video"; url: string; alt?: string | null }[];
  price_bdt: number;
  compare_at_price_bdt: number | null;
  sort_order: number;
  department_id: string;
  department_name: string;
  department_slug: string;
  semester_id: string;
  semester_name: string;
  semester_slug: string;
  subject_count: number;
  lesson_count: number;
  is_featured: boolean;
};

export const listPublicCourses = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCourseCard[]> => {
    const sb = serverPublic();
    const [coursesRes, depsRes, semsRes, placeRes] = await Promise.all([
      sb
        .from("lms_courses")
        .select(
          "id, slug, title, description, cover_image_url, media_items, price_bdt, compare_at_price_bdt, sort_order, department_id, semester_id, is_featured",
        )
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at", { ascending: false }),
      sb.from("lms_departments").select("id, name, slug").eq("is_active", true),
      sb.from("lms_semesters").select("id, name, slug").eq("is_active", true),
      sb.from("lms_subject_placements").select("department_id, semester_id, subject_id"),
    ]);
    if (coursesRes.error) throw new Error(coursesRes.error.message);
    if (depsRes.error) throw new Error(depsRes.error.message);
    if (semsRes.error) throw new Error(semsRes.error.message);

    const depMap = new Map<string, any>(((depsRes.data ?? []) as any[]).map((d) => [d.id, d]));
    const semMap = new Map<string, any>(((semsRes.data ?? []) as any[]).map((s) => [s.id, s]));
    const subjectSetByPair = new Map<string, Set<string>>();
    for (const p of (placeRes.data ?? []) as any[]) {
      const k = `${p.department_id}:${p.semester_id}`;
      const set = subjectSetByPair.get(k) ?? new Set<string>();
      set.add(p.subject_id);
      subjectSetByPair.set(k, set);
    }

    // lesson counts per pair via subjects → modules → lessons (public read OK)
    const allSubjectIds = Array.from(
      new Set(Array.from(subjectSetByPair.values()).flatMap((s) => Array.from(s))),
    );
    let lessonsBySubject = new Map<string, number>();
    if (allSubjectIds.length > 0) {
      const { data: modRows } = await sb
        .from("lms_modules")
        .select("id, subject_id")
        .in("subject_id", allSubjectIds);
      const modToSubject = new Map<string, string>();
      const modIds: string[] = [];
      for (const m of (modRows ?? []) as any[]) {
        modToSubject.set(m.id, m.subject_id);
        modIds.push(m.id);
      }
      if (modIds.length > 0) {
        const { data: lessonRows } = await sb
          .from("lms_lessons")
          .select("id, module_id")
          .in("module_id", modIds);
        for (const l of (lessonRows ?? []) as any[]) {
          const sid = modToSubject.get(l.module_id);
          if (!sid) continue;
          lessonsBySubject.set(sid, (lessonsBySubject.get(sid) ?? 0) + 1);
        }
      }
    }

    return ((coursesRes.data ?? []) as any[])
      .map((r): PublicCourseCard | null => {
        const dep = depMap.get(r.department_id);
        const sem = semMap.get(r.semester_id);
        if (!dep || !sem) return null;
        const media = Array.isArray(r.media_items) ? (r.media_items as any[]) : [];
        const key = `${r.department_id}:${r.semester_id}`;
        const subjectIds = Array.from(subjectSetByPair.get(key) ?? []);
        const lessonCount = subjectIds.reduce(
          (a, sid) => a + (lessonsBySubject.get(sid) ?? 0),
          0,
        );
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          description: r.description ?? null,
          cover_image_url: r.cover_image_url ?? null,
          media_items: media.map((m: any) => ({
            id: String(m.id ?? Math.random().toString(36).slice(2)),
            type: m.type === "video" ? "video" : "image",
            url: String(m.url ?? ""),
            alt: m.alt ?? null,
          })),
          price_bdt: Number(r.price_bdt ?? 0),
          compare_at_price_bdt:
            r.compare_at_price_bdt == null ? null : Number(r.compare_at_price_bdt),
          sort_order: Number(r.sort_order ?? 0),
          department_id: r.department_id,
          department_name: dep.name,
          department_slug: dep.slug,
          semester_id: r.semester_id,
          semester_name: sem.name,
          semester_slug: sem.slug,
          subject_count: subjectIds.length,
          lesson_count: lessonCount,
          is_featured: !!r.is_featured,
        };
      })
      .filter((x): x is PublicCourseCard => x !== null);
  },
);

export type PublicCourseDetail = {
  course: PublicCourseCard & {
    meta_title: string | null;
    meta_description: string | null;
  };
  subjects: {
    id: string;
    name: string;
    slug: string;
    modules: {
      id: string;
      title: string;
      lesson_count: number;
      lessons: { id: string; title: string; is_free: boolean; duration_seconds: number | null }[];
    }[];
  }[];
};

export const getPublicCourseByPair = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({ dept_slug: z.string().min(1), sem_slug: z.string().min(1) }).parse(i),
  )
  .handler(async ({ data }): Promise<PublicCourseDetail | null> => {
    const sb = serverPublic();
    const [depRes, semRes] = await Promise.all([
      sb.from("lms_departments").select("id, name, slug").eq("slug", data.dept_slug).maybeSingle(),
      sb.from("lms_semesters").select("id, name, slug").eq("slug", data.sem_slug).maybeSingle(),
    ]);
    const dep = depRes.data as any;
    const sem = semRes.data as any;
    if (!dep || !sem) return null;

    const { data: courseRow } = await sb
      .from("lms_courses")
      .select("*")
      .eq("department_id", dep.id)
      .eq("semester_id", sem.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!courseRow) return null;
    const c = courseRow as any;

    const { data: placements } = await sb
      .from("lms_subject_placements")
      .select("subject_id")
      .eq("department_id", dep.id)
      .eq("semester_id", sem.id);
    const subjectIds = ((placements ?? []) as any[]).map((p) => p.subject_id);

    let subjects: any[] = [];
    const modulesBySubject = new Map<string, any[]>();
    const lessonsByModule = new Map<string, any[]>();
    if (subjectIds.length > 0) {
      const { data: subjRows } = await sb
        .from("lms_subjects")
        .select("id, name, slug, sort_order, is_active")
        .in("id", subjectIds)
        .eq("is_active", true)
        .order("sort_order");
      subjects = (subjRows ?? []) as any[];

      if (subjects.length > 0) {
        const { data: modRows } = await sb
          .from("lms_modules")
          .select("id, subject_id, title, sort_order")
          .in("subject_id", subjects.map((s) => s.id))
          .order("sort_order");
        const modules = (modRows ?? []) as any[];
        for (const m of modules) {
          const arr = modulesBySubject.get(m.subject_id) ?? [];
          arr.push(m);
          modulesBySubject.set(m.subject_id, arr);
        }
        const modIds = modules.map((m) => m.id);
        if (modIds.length > 0) {
          const { data: lessonRows } = await sb
            .from("lms_lessons")
            .select("id, module_id, title, is_free, duration_seconds, sort_order")
            .in("module_id", modIds)
            .order("sort_order");
          for (const l of (lessonRows ?? []) as any[]) {
            const arr = lessonsByModule.get(l.module_id) ?? [];
            arr.push(l);
            lessonsByModule.set(l.module_id, arr);
          }
        }
      }
    }

    const media = Array.isArray(c.media_items) ? (c.media_items as any[]) : [];
    let lessonCount = 0;
    const subjectsOut = subjects.map((s) => {
      const mods = (modulesBySubject.get(s.id) ?? []).map((m: any) => {
        const lessons = (lessonsByModule.get(m.id) ?? []).map((l: any) => ({
          id: l.id,
          title: l.title,
          is_free: !!l.is_free,
          duration_seconds: l.duration_seconds ?? null,
        }));
        lessonCount += lessons.length;
        return { id: m.id, title: m.title, lesson_count: lessons.length, lessons };
      });
      return { id: s.id, name: s.name, slug: s.slug, modules: mods };
    });

    return {
      course: {
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description ?? null,
        cover_image_url: c.cover_image_url ?? null,
        media_items: media.map((m: any) => ({
          id: String(m.id ?? Math.random().toString(36).slice(2)),
          type: m.type === "video" ? "video" : "image",
          url: String(m.url ?? ""),
          alt: m.alt ?? null,
        })),
        price_bdt: Number(c.price_bdt ?? 0),
        compare_at_price_bdt: c.compare_at_price_bdt == null ? null : Number(c.compare_at_price_bdt),
        sort_order: Number(c.sort_order ?? 0),
        department_id: c.department_id,
        department_name: dep.name,
        department_slug: dep.slug,
        semester_id: c.semester_id,
        semester_name: sem.name,
        semester_slug: sem.slug,
        subject_count: subjects.length,
        lesson_count: lessonCount,
        is_featured: !!c.is_featured,
        meta_title: c.meta_title ?? null,
        meta_description: c.meta_description ?? null,
      },
      subjects: subjectsOut,
    };
  });
