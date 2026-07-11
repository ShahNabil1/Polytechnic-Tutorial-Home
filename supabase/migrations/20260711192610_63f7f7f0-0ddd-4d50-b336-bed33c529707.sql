
-- Enrollments table
CREATE TABLE public.lms_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX idx_lms_enrollments_user ON public.lms_enrollments(user_id);
CREATE INDEX idx_lms_enrollments_course ON public.lms_enrollments(course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_enrollments TO authenticated;
GRANT ALL ON public.lms_enrollments TO service_role;

ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollments
CREATE POLICY "Users view own enrollments"
  ON public.lms_enrollments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'manage_lms'));

-- Staff with manage_lms can do everything
CREATE POLICY "Staff manage enrollments"
  ON public.lms_enrollments FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

CREATE TRIGGER update_lms_enrollments_updated_at
  BEFORE UPDATE ON public.lms_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access-check function
CREATE OR REPLACE FUNCTION public.has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin')
    OR public.has_permission(_user_id, 'manage_lms')
    OR EXISTS (
      SELECT 1 FROM public.lms_enrollments e
      WHERE e.user_id = _user_id
        AND e.course_id = _course_id
        AND (e.expires_at IS NULL OR e.expires_at > now())
    );
$$;
