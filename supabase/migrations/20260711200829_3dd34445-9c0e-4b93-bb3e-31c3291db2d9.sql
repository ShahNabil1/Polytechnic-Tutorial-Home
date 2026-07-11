GRANT SELECT ON public.lms_courses TO anon;

DROP POLICY IF EXISTS "Anon can view active courses" ON public.lms_courses;
CREATE POLICY "Anon can view active courses"
  ON public.lms_courses FOR SELECT
  TO anon
  USING (is_active = true);

GRANT SELECT ON public.lms_subject_placements TO anon;

DROP POLICY IF EXISTS "Anon can view subject placements" ON public.lms_subject_placements;
CREATE POLICY "Anon can view subject placements"
  ON public.lms_subject_placements FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Students self enroll" ON public.lms_enrollments;
CREATE POLICY "Students self enroll"
  ON public.lms_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_role(auth.uid(), 'student')
  );

DROP POLICY IF EXISTS "Students update own enrollment" ON public.lms_enrollments;
CREATE POLICY "Students update own enrollment"
  ON public.lms_enrollments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'student'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'student'));