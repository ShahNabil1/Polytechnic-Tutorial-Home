
-- =========================================================
-- CRM Phase 2: messaging + tracking + user carts
-- =========================================================

-- 1) CRM SMS deliveries (works for signed-up users AND guest phones)
CREATE TABLE public.crm_sms_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_phone text NOT NULL,
  body text NOT NULL,
  template_id uuid REFERENCES public.sms_templates(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'manual',
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  sms_count integer,
  is_unicode boolean,
  provider_status integer,
  provider_response text,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_sms_deliveries_user_idx ON public.crm_sms_deliveries(user_id, created_at DESC);
CREATE INDEX crm_sms_deliveries_phone_idx ON public.crm_sms_deliveries(to_phone, created_at DESC);

GRANT SELECT ON public.crm_sms_deliveries TO authenticated;
GRANT ALL ON public.crm_sms_deliveries TO service_role;

ALTER TABLE public.crm_sms_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crm sms"
  ON public.crm_sms_deliveries FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE TRIGGER crm_sms_deliveries_updated_at
  BEFORE UPDATE ON public.crm_sms_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) CRM Email deliveries (reuses order email_delivery_status enum)
CREATE TABLE public.crm_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'manual',
  attempt_no integer NOT NULL DEFAULT 1,
  parent_delivery_id uuid REFERENCES public.crm_email_deliveries(id) ON DELETE SET NULL,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resend_email_id text,
  status public.email_delivery_status NOT NULL DEFAULT 'queued',
  error_reason text,
  bounce_type text,
  provider_payload jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_email_deliveries_user_idx ON public.crm_email_deliveries(user_id, created_at DESC);
CREATE INDEX crm_email_deliveries_email_idx ON public.crm_email_deliveries(to_email, created_at DESC);
CREATE INDEX crm_email_deliveries_resend_idx ON public.crm_email_deliveries(resend_email_id);

GRANT SELECT ON public.crm_email_deliveries TO authenticated;
GRANT ALL ON public.crm_email_deliveries TO service_role;

ALTER TABLE public.crm_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read crm email"
  ON public.crm_email_deliveries FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE TRIGGER crm_email_deliveries_updated_at
  BEFORE UPDATE ON public.crm_email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) User carts (server-side snapshot of signed-in customers' active carts)
CREATE TABLE public.user_carts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_bdt numeric NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_carts TO authenticated;
GRANT ALL ON public.user_carts TO service_role;

ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own cart"
  ON public.user_carts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can read all carts"
  ON public.user_carts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE TRIGGER user_carts_updated_at
  BEFORE UPDATE ON public.user_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
