
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.digital_fulfillment_status AS ENUM (
    'not_applicable','pending','queued','sent','delivered','bounced','failed','delayed','manual_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.physical_fulfillment_status AS ENUM (
    'not_applicable','pending','ready_to_ship','shipped','delivered','returned','hold','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.email_delivery_status AS ENUM (
    'queued','sent','delivered','bounced','delayed','failed','opened','clicked','scheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS digital_status  public.digital_fulfillment_status  NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS physical_status public.physical_fulfillment_status NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS digital_delivered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS digital_locked_until  timestamptz,
  ADD COLUMN IF NOT EXISTS digital_last_error    text,
  ADD COLUMN IF NOT EXISTS digital_attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS digital_next_retry_at timestamptz;

-- 3. Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ebook_file_url text;

-- 4. order_email_deliveries
CREATE TABLE IF NOT EXISTS public.order_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  attempt_no int NOT NULL DEFAULT 1,
  resend_email_id text,
  to_email text NOT NULL,
  from_email text,
  subject text,
  status public.email_delivery_status NOT NULL DEFAULT 'queued',
  error_reason text,
  bounce_type text,
  provider_payload jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_email_deliveries TO authenticated;
GRANT ALL ON public.order_email_deliveries TO service_role;

ALTER TABLE public.order_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email deliveries" ON public.order_email_deliveries;
CREATE POLICY "Admins can view email deliveries"
  ON public.order_email_deliveries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'employee')
  );

CREATE INDEX IF NOT EXISTS idx_oed_order_id ON public.order_email_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_oed_resend_email_id ON public.order_email_deliveries(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_oed_status ON public.order_email_deliveries(status);

DROP TRIGGER IF EXISTS trg_oed_updated_at ON public.order_email_deliveries;
CREATE TRIGGER trg_oed_updated_at BEFORE UPDATE ON public.order_email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. recompute_order_status
CREATE OR REPLACE FUNCTION public.recompute_order_status(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.digital_fulfillment_status;
  p public.physical_fulfillment_status;
  cur text;
  next_status text;
BEGIN
  SELECT digital_status, physical_status, status
    INTO d, p, cur
  FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF cur IN ('cancelled','returned','hold','incomplete') THEN
    RETURN;
  END IF;

  IF p = 'not_applicable' THEN
    IF d = 'delivered' THEN next_status := 'delivered';
    ELSE next_status := 'processing';
    END IF;
  ELSIF d = 'not_applicable' THEN
    RETURN;
  ELSE
    IF d = 'delivered' AND p = 'delivered' THEN
      next_status := 'delivered';
    ELSE
      RETURN;
    END IF;
  END IF;

  IF next_status IS NOT NULL AND next_status <> cur THEN
    UPDATE public.orders SET status = next_status, updated_at = now()
     WHERE id = _order_id;
  END IF;
END; $$;

-- 6. initialize_order_fulfillment (rename vars to avoid ambiguity)
CREATE OR REPLACE FUNCTION public.initialize_order_fulfillment(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_digital boolean;
  v_has_physical boolean;
BEGIN
  SELECT
    bool_or(item_type = 'ebook'),
    bool_or(item_type = 'physical')
  INTO v_has_digital, v_has_physical
  FROM public.order_items WHERE order_id = _order_id;

  UPDATE public.orders o
     SET
       digital_status = CASE
         WHEN COALESCE(v_has_digital,false) AND o.digital_status = 'not_applicable'
           THEN 'pending'::digital_fulfillment_status
         ELSE o.digital_status END,
       physical_status = CASE
         WHEN COALESCE(v_has_physical,false) AND o.physical_status = 'not_applicable'
           THEN 'pending'::physical_fulfillment_status
         ELSE o.physical_status END,
       digital_locked_until = CASE
         WHEN COALESCE(v_has_digital,false) AND o.digital_status = 'not_applicable'
           THEN now() + interval '2 minutes'
         ELSE o.digital_locked_until END
   WHERE o.id = _order_id;
END; $$;

-- 7. Trigger
CREATE OR REPLACE FUNCTION public.trg_orders_processing_init()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'processing'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.initialize_order_fulfillment(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_processing_init ON public.orders;
CREATE TRIGGER orders_processing_init
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_processing_init();

-- 8. Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_email_deliveries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE status = 'processing' LOOP
    PERFORM public.initialize_order_fulfillment(r.id);
  END LOOP;
END $$;
