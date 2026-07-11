
-- Remove auto-enroll wiring
DROP TRIGGER IF EXISTS orders_auto_enroll ON public.orders;
DROP FUNCTION IF EXISTS public.trg_orders_auto_enroll();
DROP FUNCTION IF EXISTS public.enroll_user_from_order(uuid);

-- Remove course_id from order_items (safe: nothing else references it)
DROP INDEX IF EXISTS public.idx_order_items_course;
ALTER TABLE public.order_items DROP COLUMN IF EXISTS course_id;

-- Restore original item_type check (physical, ebook only)
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_item_type_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_item_type_check
  CHECK (item_type IN ('physical', 'ebook'));
