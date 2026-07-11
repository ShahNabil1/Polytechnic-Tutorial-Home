# Courses upgrade — nav, media, SEO, curriculum view

## 1. Sidebar reorder (workspace nav)
Change LMS submenu order in `src/routes/_authenticated/_internal.workspace.tsx` to:
1. Academic Structure
2. Subjects
3. Courses

## 2. Course schema additions (DB migration)
Add columns to `public.lms_courses`:
- `meta_title text` — SEO title override
- `meta_description text` — SEO description
- `media_items jsonb not null default '[]'::jsonb` — ordered array of `{ id, type: 'image'|'video', url, alt? }`. Max 5 images + 1 optional video enforced app-side.

Keep existing `cover_image_url` as the first-image fallback (auto-synced to `media_items[0]` when it's an image).

## 3. Course form dialog (`CourseFormDialog.tsx`)
Extend with:
- **Meta Title** input (falls back to `title` if empty)
- **Meta Description** textarea (160 char guide)
- **Media Gallery** (replaces single Cover Image field):
  - Reuse the exact product image cropper (`ImageCropperDialog`) + `browser-image-compression` pipeline that products use
  - Up to 5 images, each with crop + client-side compress via `uploadFileToR2` (same `compress` opts)
  - One optional video slot (`.mp4`/`.webm`, direct R2 upload, no compress)
  - Drag-to-reorder handles across all media (images + video) using existing dnd approach — order stored in `media_items`
  - First image auto-becomes `cover_image_url`
- Keep existing Price / Compare-at / Sort order / Active / Slug / Description

## 4. Admin Course Detail view (`CourseDetail.tsx`)
Currently sparse. Add curriculum snapshot that reuses live data from Subjects/Structure:
- Fetch subjects placed in this course's `(department_id, semester_id)` pair
- Per subject: name, code, module count, total lesson (video) count
- Expandable per subject → list of modules with lesson count per module
- Reuse existing `LmsSubject` / `LmsModuleWithLessons` types + a new server fn `listCourseCurriculum(courseId)` that joins `lms_subject_placements` → `lms_subjects` → `lms_modules` → `lms_lessons`

## 5. Public course page (`sdash.courses.$deptSlug.$semSlug.tsx`)
- Render the media gallery in the stored order (image carousel + video player when present), respecting course `sort_order` on the listing
- Set `head()` meta from `meta_title` / `meta_description` (fallbacks: title / description)
- Add `og:title`, `og:description`, `og:image` (first image from `media_items`), `og:type: product`, `twitter:card: summary_large_image`
- Add JSON-LD `Course` schema (name, description, provider Organization, image, offers with `price_bdt` BDT, `hasCourseInstance` optional) via `scripts` in `head()`
- Canonical link to the course URL

## 6. Public courses index (`sdash.courses.tsx`)
Sort listing by `sort_order` then `title` so the admin's Sort Order actually controls display order on the site.

## Technical notes
- Migration also backfills `media_items` from existing `cover_image_url` for old rows
- `upsertCourse` server fn extended with new fields; validate max 5 images + 1 video server-side
- Video upload uses same R2 flow but skips the image-compress step (guard by mime type)
- Cropper aspect: 16/9 to match current card display
- No changes to enrollment / orders logic

## Files touched
- `src/routes/_authenticated/_internal.workspace.tsx` (nav order)
- `supabase/migrations/<new>.sql`
- `src/lib/lms.ts` (types)
- `src/lib/lms.functions.ts` (upsertCourse fields + new `listCourseCurriculum`)
- `src/components/internal/lms/CourseFormDialog.tsx` (rewrite media section, add SEO fields)
- `src/components/internal/lms/CourseDetail.tsx` (curriculum panel)
- `src/routes/_authenticated/sdash.courses.$deptSlug.$semSlug.tsx` (gallery + SEO head + JSON-LD)
- `src/routes/_authenticated/sdash.courses.tsx` (sort order)

Approve and I'll ship it in one migration + edits.
