ALTER TABLE public.internal_profiles
  ADD COLUMN IF NOT EXISTS nid_front_r2_key text,
  ADD COLUMN IF NOT EXISTS nid_back_r2_key text,
  ADD COLUMN IF NOT EXISTS nid_resubmit_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS nid_resubmit_reason text,
  ADD COLUMN IF NOT EXISTS nid_resubmit_requested_by uuid;