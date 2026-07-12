
DROP POLICY IF EXISTS "Authenticated can view courses" ON public.lms_courses;
CREATE POLICY "Authenticated can view active courses"
  ON public.lms_courses
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_permission(auth.uid(), 'manage_lms'));

DROP POLICY IF EXISTS "anyone can view lessons of active subjects" ON public.lms_lessons;

CREATE POLICY "Free lessons of active subjects are public"
  ON public.lms_lessons
  FOR SELECT
  TO anon, authenticated
  USING (
    is_free = true
    AND EXISTS (
      SELECT 1
      FROM public.lms_modules m
      JOIN public.lms_subjects s ON s.id = m.subject_id
      WHERE m.id = lms_lessons.module_id AND s.is_active = true
    )
  );

CREATE POLICY "Enrolled users can view paid lessons"
  ON public.lms_lessons
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission(auth.uid(), 'manage_lms')
    OR EXISTS (
      SELECT 1
      FROM public.lms_modules m
      JOIN public.lms_subjects s ON s.id = m.subject_id
      JOIN public.lms_subject_placements sp ON sp.subject_id = s.id
      JOIN public.lms_courses c
        ON c.department_id = sp.department_id
       AND c.semester_id = sp.semester_id
      JOIN public.lms_enrollments e
        ON e.course_id = c.id
       AND e.user_id = auth.uid()
       AND (e.expires_at IS NULL OR e.expires_at > now())
      WHERE m.id = lms_lessons.module_id AND s.is_active = true
    )
  );

REVOKE USAGE ON SCHEMA graphql FROM anon, authenticated;
REVOKE USAGE ON SCHEMA graphql_public FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.next_order_no() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_incomplete_attempt(text, uuid, text, text, text, text, text, text, text, jsonb, numeric, numeric, numeric, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_order_status(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_order_fulfillment(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.coupon_bump_uses() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_orders_processing_init() FROM anon, authenticated;
