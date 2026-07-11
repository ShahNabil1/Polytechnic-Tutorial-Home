CREATE TABLE public.lms_subject_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.lms_subjects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.lms_departments(id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.lms_semesters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, department_id, semester_id)
);

CREATE INDEX lms_subject_placements_subject_idx ON public.lms_subject_placements(subject_id);
CREATE INDEX lms_subject_placements_dept_sem_idx ON public.lms_subject_placements(department_id, semester_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_subject_placements TO authenticated;
GRANT ALL ON public.lms_subject_placements TO service_role;

ALTER TABLE public.lms_subject_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view placements"
  ON public.lms_subject_placements FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers can manage placements"
  ON public.lms_subject_placements FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_lms'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));

-- Backfill: cross-product of existing dept x sem per subject
INSERT INTO public.lms_subject_placements (subject_id, department_id, semester_id)
SELECT d.subject_id, d.category_id, s.category_id
  FROM public.lms_subject_departments d
  JOIN public.lms_subject_semesters s ON s.subject_id = d.subject_id
ON CONFLICT DO NOTHING;
