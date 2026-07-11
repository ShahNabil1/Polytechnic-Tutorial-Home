
-- 1. Add course_id column to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.lms_courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_course ON public.order_items(course_id) WHERE course_id IS NOT NULL;

-- Relax item_type: allow 'course'. Drop any check constraint if present, then re-add.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.order_items'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%item_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_item_type_check
  CHECK (item_type IN ('physical', 'ebook', 'course'));

-- 2. Function: enroll buyer in every course present on an order
CREATE OR REPLACE FUNCTION public.enroll_user_from_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.orders WHERE id = _order_id;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.lms_enrollments (user_id, course_id, order_id, granted_at, note)
  SELECT v_user_id, oi.course_id, _order_id, now(), 'auto: order ' || _order_id::text
    FROM public.order_items oi
   WHERE oi.order_id = _order_id
     AND oi.course_id IS NOT NULL
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET order_id = EXCLUDED.order_id,
        expires_at = NULL,
        updated_at = now();
END; $$;

-- 3. Trigger: on order becoming processing/delivered, run auto-enrollment
CREATE OR REPLACE FUNCTION public.trg_orders_auto_enroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('processing', 'delivered')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.enroll_user_from_order(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS orders_auto_enroll ON public.orders;
CREATE TRIGGER orders_auto_enroll
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_auto_enroll();
