
-- =========================================================
-- LMS Core Schema
-- =========================================================

-- Subjects
CREATE TABLE public.lms_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lms_subjects_code_unique ON public.lms_subjects (lower(code)) WHERE code IS NOT NULL;
CREATE INDEX lms_subjects_active_idx ON public.lms_subjects (is_active, sort_order);

GRANT SELECT ON public.lms_subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_subjects TO authenticated;
GRANT ALL ON public.lms_subjects TO service_role;

ALTER TABLE public.lms_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can view active subjects" ON public.lms_subjects
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "authenticated can view active subjects" ON public.lms_subjects
  FOR SELECT TO authenticated USING (is_active = true OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can insert subjects" ON public.lms_subjects
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can update subjects" ON public.lms_subjects
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can delete subjects" ON public.lms_subjects
  FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'manage_lms'));

CREATE TRIGGER lms_subjects_updated_at BEFORE UPDATE ON public.lms_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subject <-> Department (product_categories kind='department')
CREATE TABLE public.lms_subject_departments (
  subject_id uuid NOT NULL REFERENCES public.lms_subjects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, category_id)
);
CREATE INDEX lms_subject_departments_cat_idx ON public.lms_subject_departments (category_id);

GRANT SELECT ON public.lms_subject_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_subject_departments TO authenticated;
GRANT ALL ON public.lms_subject_departments TO service_role;

ALTER TABLE public.lms_subject_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view subject departments" ON public.lms_subject_departments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lms managers can write subject departments" ON public.lms_subject_departments
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

-- Subject <-> Semester
CREATE TABLE public.lms_subject_semesters (
  subject_id uuid NOT NULL REFERENCES public.lms_subjects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, category_id)
);
CREATE INDEX lms_subject_semesters_cat_idx ON public.lms_subject_semesters (category_id);

GRANT SELECT ON public.lms_subject_semesters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_subject_semesters TO authenticated;
GRANT ALL ON public.lms_subject_semesters TO service_role;

ALTER TABLE public.lms_subject_semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view subject semesters" ON public.lms_subject_semesters
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lms managers can write subject semesters" ON public.lms_subject_semesters
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

-- Modules
CREATE TABLE public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.lms_subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lms_modules_subject_idx ON public.lms_modules (subject_id, sort_order);

GRANT SELECT ON public.lms_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_modules TO authenticated;
GRANT ALL ON public.lms_modules TO service_role;

ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can view modules of active subjects" ON public.lms_modules
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_subjects s WHERE s.id = subject_id AND s.is_active = true)
         OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can write modules" ON public.lms_modules
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

CREATE TRIGGER lms_modules_updated_at BEFORE UPDATE ON public.lms_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lessons
CREATE TABLE public.lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_url text,
  video_provider text NOT NULL DEFAULT 'r2',
  thumbnail_url text,
  duration_seconds integer,
  is_free boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lms_lessons_video_provider_check CHECK (video_provider IN ('r2','youtube','vimeo','external'))
);
CREATE INDEX lms_lessons_module_idx ON public.lms_lessons (module_id, sort_order);
CREATE INDEX lms_lessons_free_idx ON public.lms_lessons (is_free);

GRANT SELECT ON public.lms_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lessons TO authenticated;
GRANT ALL ON public.lms_lessons TO service_role;

ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
-- Metadata visible to everyone whose parent subject is active; full video access will be gated in app layer.
CREATE POLICY "anyone can view lessons of active subjects" ON public.lms_lessons
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
      SELECT 1 FROM public.lms_modules m
       JOIN public.lms_subjects s ON s.id = m.subject_id
      WHERE m.id = module_id AND s.is_active = true
    ) OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can write lessons" ON public.lms_lessons
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

CREATE TRIGGER lms_lessons_updated_at BEFORE UPDATE ON public.lms_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Subject <-> Instructor assignments (future use)
CREATE TABLE public.lms_subject_instructors (
  subject_id uuid NOT NULL REFERENCES public.lms_subjects(id) ON DELETE CASCADE,
  instructor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, instructor_user_id)
);
CREATE INDEX lms_subject_instructors_user_idx ON public.lms_subject_instructors (instructor_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_subject_instructors TO authenticated;
GRANT ALL ON public.lms_subject_instructors TO service_role;

ALTER TABLE public.lms_subject_instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instructors can view their assignments" ON public.lms_subject_instructors
  FOR SELECT TO authenticated
  USING (instructor_user_id = auth.uid() OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms managers can write instructor assignments" ON public.lms_subject_instructors
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));
