
-- 1. New enum value for email deliveries (must be a separate statement before use)
ALTER TYPE public.email_delivery_status ADD VALUE IF NOT EXISTS 'skipped';

-- 2. Campaigns table
CREATE TABLE public.crm_bulk_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  subject text,
  body text NOT NULL,
  template_id uuid,
  sender_user_id uuid,
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped_no_contact integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.crm_bulk_campaigns TO authenticated;
GRANT ALL ON public.crm_bulk_campaigns TO service_role;

ALTER TABLE public.crm_bulk_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view campaigns"
  ON public.crm_bulk_campaigns FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Staff can insert campaigns"
  ON public.crm_bulk_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Staff can update campaigns"
  ON public.crm_bulk_campaigns FOR UPDATE
  TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE TRIGGER trg_crm_bulk_campaigns_updated_at
  BEFORE UPDATE ON public.crm_bulk_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Link deliveries back to campaigns
ALTER TABLE public.crm_sms_deliveries
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.crm_bulk_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_delivery_id uuid;

ALTER TABLE public.crm_email_deliveries
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.crm_bulk_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_sms_deliveries_campaign_id ON public.crm_sms_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_deliveries_campaign_id ON public.crm_email_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_bulk_campaigns_created_at ON public.crm_bulk_campaigns(created_at DESC);

-- 4. Allow empty contact + 'skipped' status on sms deliveries (email uses enum + already has 'skipped')
ALTER TABLE public.crm_sms_deliveries
  ALTER COLUMN to_phone DROP NOT NULL;
ALTER TABLE public.crm_email_deliveries
  ALTER COLUMN to_email DROP NOT NULL,
  ALTER COLUMN subject DROP NOT NULL,
  ALTER COLUMN body_html DROP NOT NULL;
