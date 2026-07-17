ALTER TABLE public.crm_sms_deliveries
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS crm_sms_deliveries_provider_message_id_idx
  ON public.crm_sms_deliveries(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_sms_deliveries_to_phone_created_idx
  ON public.crm_sms_deliveries(to_phone, created_at DESC)
  WHERE to_phone IS NOT NULL;