-- Phase 3 CRM: segments table
CREATE TABLE public.crm_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('customers','signed','guests','incomplete')),
  filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_segments TO authenticated;
GRANT ALL ON public.crm_segments TO service_role;

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM staff can manage segments"
  ON public.crm_segments FOR ALL
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE TRIGGER update_crm_segments_updated_at
  BEFORE UPDATE ON public.crm_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX crm_segments_kind_idx ON public.crm_segments(kind, created_at DESC);