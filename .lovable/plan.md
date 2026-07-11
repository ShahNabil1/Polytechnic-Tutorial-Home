# LMS & Courses — Phases 1-3

Base route: `/workspace/lms-and-courses/`. Access gated by a new `manage_lms` permission (super_admin bypasses). Use existing "LMS & Courses" nav group added to `InternalShell` with three items: Academic Structure, Subjects, Curriculum.

## Taxonomy decision (needs your call)

`product_categories` already contains `kind='department'` and `kind='semester'` rows (Computer, Civil, …, 1st–8th sem) used by the shop. Two options:

- **A. Reuse `product_categories**` (my recommendation). One source of truth — a student's dept/semester filters both shop products and LMS subjects with the same IDs. Academic Structure becomes a focused editor over those rows.
- **B. Separate `lms_departments` / `lms_semesters` tables**. Fully independent from shop taxonomy; more freedom, but you'll re-enter values and map them yourself for student enrollment later.

Plan below assumes **A**. Say the word if you want **B** and I'll swap the schema.

## Phase 1 — Academic Structure

**Route:** `/workspace/lms-and-courses/structure`

- Tabbed layout: `Departments | Semesters`.
- Each tab: list rows with inline edit, sort-order number input, active toggle, delete (with confirm). "Add" row at top.
- Backed by existing `product_categories` filtered by kind. New server fns in `src/lib/lms.functions.ts`: `listAcademicTaxonomy`, `upsertAcademicTaxonomy`, `deleteAcademicTaxonomy` — guarded by `manage_lms` (super_admin bypass).

## Phase 2 — Subjects Hub

**Route:** `/workspace/lms-and-courses/subjects`

New tables:

- `lms_subjects` — `name`, `code` (nullable, unique when set), `slug` (unique), `description`, `cover_image_url`, `is_active`, `sort_order`, `created_by`, timestamps.
- `lms_subject_departments` — (`subject_id`, `category_id`) → `product_categories` (kind=department).
- `lms_subject_semesters` — (`subject_id`, `category_id`) → `product_categories` (kind=semester).

RLS + GRANTs:

- authenticated: SELECT active subjects and their joins.
- `manage_lms` (or super_admin): full write.
- anon: SELECT active subjects only (for a future public catalog).
- service_role: ALL.

UI:

- Toolbar: search, filter by department/semester, "Add Subject" button.
- Grid of glassmorphic cards: cover image with gradient overlay, title, code chip, dept/sem chips, lesson count (once curriculum exists), active dot.
- Card click → `/workspace/lms-and-courses/curriculum/$subjectSlug`.
- Card menu: Edit, Toggle active, Delete.
- "Add / Edit Subject" modal form: Name, Code, auto-generated editable Slug, Cover Image (R2 upload via existing `uploadFileToR2` with folder `uploads` and image compression), Description (multiline), multi-select Departments, multi-select Semesters, Active toggle.

## Phase 3 — Curriculum Builder

**Route:** `/workspace/lms-and-courses/curriculum/$subjectSlug`

New tables:

- `lms_modules` — `subject_id`, `title`, `description`, `sort_order`, timestamps.
- `lms_lessons` — `module_id`, `title`, `description`, `video_url`, `video_provider` ('r2'|'youtube'|'vimeo'|'external'), `thumbnail_url`, `duration_seconds` (nullable), `is_free` (bool, default false), `sort_order`, timestamps.

Uploads via R2 — extend `UploadFolder` with `lms-videos` and `lms-thumbs` (uses existing presigned PUT). Video field also accepts pasted external URL (YouTube/Vimeo/direct mp4).

UI:

- Header: subject cover, name, code, dept/sem chips, "Back to Subjects".
- Modules list: each module is a collapsible card with title, description, drag handle for sort, edit/delete menu, and "Add Lesson" button.
- Lessons inside module: row with thumbnail, title, "Free/Demo" badge if `is_free`, duration, edit/delete.
- Lesson form (modal): Title, Description, Thumbnail (R2 upload), Video (R2 upload or URL), a prominent switch **"Set as Free/Demo — any student can watch this lesson without purchasing the course"**.

## Future-proofing (built now, no UI exposed yet)

- `lms_subject_instructors` — (`subject_id`, `instructor_user_id`, `role` default 'primary', `assigned_at`). RLS lets an instructor read their own assignments; admins manage. Phase 4 admin UI will slot in without schema change.
- `is_free` on lessons + `is_active` on subjects → student dashboard becomes: subjects joined to dept/sem categories matching the student's `profiles.department` and `profiles.semester`, then lesson-view checks `is_free OR enrolled(user, subject)`. Enrollment table to be added when that phase lands.

## Files to add / modify

New:

- `supabase/migrations/<ts>_lms_core.sql` — subjects/modules/lessons/joins/instructor-assignments + RLS + GRANTs + `updated_at` triggers + seed `manage_lms` permission.
- `src/lib/lms.functions.ts` — server fns (taxonomy, subjects, modules, lessons).
- `src/lib/lms.ts` — shared TS types.
- `src/routes/_authenticated/_internal.workspace.lms-and-courses.tsx` — layout with `<Outlet/>`.
- `src/routes/_authenticated/_internal.workspace.lms-and-courses.structure.tsx`
- `src/routes/_authenticated/_internal.workspace.lms-and-courses.subjects.tsx`
- `src/routes/_authenticated/_internal.workspace.lms-and-courses.curriculum.$subjectSlug.tsx`
- `src/components/internal/lms/AcademicStructureManager.tsx`
- `src/components/internal/lms/SubjectsManager.tsx` + `SubjectFormDialog.tsx`
- `src/components/internal/lms/CurriculumBuilder.tsx` + `ModuleEditor.tsx` + `LessonFormDialog.tsx`

Modified:

- `src/components/internal/InternalShell.tsx` usage in `_internal.workspace.tsx` — replace empty `lms` group with the three items above (icons: `BookOpen`, `GraduationCap`, `Layers`, `PlayCircle`).
- `src/lib/upload-client.ts` — add `lms-videos`, `lms-thumbs` folders.

## Please confirm before I build

1. **Reuse `product_categories` for dept/semester (option A)?** Or create separate LMS tables (option B)?
2. **Videos:** R2 direct upload + external URL paste both supported — OK?
3. **Access:** gate everything behind a new `manage_lms` permission (super_admin bypass), or reuse existing `manage_products`?