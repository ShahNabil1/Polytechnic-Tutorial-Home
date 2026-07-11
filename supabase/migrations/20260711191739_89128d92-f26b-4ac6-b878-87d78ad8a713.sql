CREATE TABLE public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.lms_departments(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.lms_semesters(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  price_bdt numeric(10,2) NOT NULL DEFAULT 0,
  compare_at_price_bdt numeric(10,2),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, semester_id)
);

CREATE INDEX lms_courses_dept_sem_idx ON public.lms_courses(department_id, semester_id);
CREATE INDEX lms_courses_active_idx ON public.lms_courses(is_active) WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_courses TO authenticated;
GRANT ALL ON public.lms_courses TO service_role;

ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view courses"
  ON public.lms_courses FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers can manage courses"
  ON public.lms_courses FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

CREATE TRIGGER update_lms_courses_updated_at
  BEFORE UPDATE ON public.lms_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
