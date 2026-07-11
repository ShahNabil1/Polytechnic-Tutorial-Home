-- 1) Extend email deliveries with kind + sender attribution
ALTER TABLE public.order_email_deliveries
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ebook_delivery',
  ADD COLUMN IF NOT EXISTS sender_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_order_email_deliveries_kind
  ON public.order_email_deliveries(order_id, kind, created_at DESC);

-- 2) New SMS deliveries log
CREATE TABLE IF NOT EXISTS public.order_sms_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'manual', -- 'order_confirm' | 'manual' | 'other'
  sender_user_id uuid,
  to_phone text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  sms_count integer NOT NULL DEFAULT 1,
  is_unicode boolean NOT NULL DEFAULT false,
  provider_status integer,
  provider_response text,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_sms_deliveries TO authenticated;
GRANT ALL ON public.order_sms_deliveries TO service_role;

ALTER TABLE public.order_sms_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read SMS deliveries"
  ON public.order_sms_deliveries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_order_sms_deliveries_order
  ON public.order_sms_deliveries(order_id, created_at DESC);

CREATE TRIGGER trg_order_sms_deliveries_updated
  BEFORE UPDATE ON public.order_sms_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();