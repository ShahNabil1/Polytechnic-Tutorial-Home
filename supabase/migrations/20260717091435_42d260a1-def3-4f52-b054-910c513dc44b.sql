
-- 1) Phone normalizer: last 11 digits, treating +880 as country code
CREATE OR REPLACE FUNCTION public.normalize_bd_phone(_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _p IS NULL OR btrim(_p) = '' THEN NULL
    ELSE right(regexp_replace(_p, '\D', '', 'g'), 11)
  END;
$$;

-- 2) Auto-link trigger for orders
CREATE OR REPLACE FUNCTION public.orders_autolink_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.id INTO v_id
  FROM public.profiles p
  WHERE (
      NEW.customer_phone IS NOT NULL
      AND public.normalize_bd_phone(p.phone) IS NOT NULL
      AND public.normalize_bd_phone(p.phone) = public.normalize_bd_phone(NEW.customer_phone)
    )
     OR (
      NEW.customer_email IS NOT NULL
      AND p.email IS NOT NULL
      AND lower(p.email) = lower(NEW.customer_email)
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    NEW.user_id := v_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_autolink_user ON public.orders;
CREATE TRIGGER trg_orders_autolink_user
  BEFORE INSERT OR UPDATE OF customer_phone, customer_email, user_id ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_autolink_user();

-- 3) Same for incomplete_checkouts
CREATE OR REPLACE FUNCTION public.incomplete_autolink_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT p.id INTO v_id
  FROM public.profiles p
  WHERE (
      NEW.customer_phone IS NOT NULL
      AND public.normalize_bd_phone(p.phone) IS NOT NULL
      AND public.normalize_bd_phone(p.phone) = public.normalize_bd_phone(NEW.customer_phone)
    )
     OR (
      NEW.customer_email IS NOT NULL
      AND p.email IS NOT NULL
      AND lower(p.email) = lower(NEW.customer_email)
    )
  ORDER BY p.created_at ASC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    NEW.user_id := v_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incomplete_autolink_user ON public.incomplete_checkouts;
CREATE TRIGGER trg_incomplete_autolink_user
  BEFORE INSERT OR UPDATE OF customer_phone, customer_email, user_id ON public.incomplete_checkouts
  FOR EACH ROW
  EXECUTE FUNCTION public.incomplete_autolink_user();

-- 4) Profile trigger: on signup / phone-email change, backfill past guest rows
CREATE OR REPLACE FUNCTION public.profiles_backfill_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_bd_phone(NEW.phone);
BEGIN
  UPDATE public.orders o
     SET user_id = NEW.id
   WHERE o.user_id IS NULL
     AND (
       (v_norm IS NOT NULL AND public.normalize_bd_phone(o.customer_phone) = v_norm)
       OR (NEW.email IS NOT NULL AND o.customer_email IS NOT NULL
           AND lower(o.customer_email) = lower(NEW.email))
     );

  UPDATE public.incomplete_checkouts ic
     SET user_id = NEW.id
   WHERE ic.user_id IS NULL
     AND (
       (v_norm IS NOT NULL AND public.normalize_bd_phone(ic.customer_phone) = v_norm)
       OR (NEW.email IS NOT NULL AND ic.customer_email IS NOT NULL
           AND lower(ic.customer_email) = lower(NEW.email))
     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_backfill_orders ON public.profiles;
CREATE TRIGGER trg_profiles_backfill_orders
  AFTER INSERT OR UPDATE OF phone, email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_backfill_orders();

-- 5) One-time backfill for existing rows
UPDATE public.orders o
   SET user_id = p.id
  FROM public.profiles p
 WHERE o.user_id IS NULL
   AND (
     (o.customer_phone IS NOT NULL AND p.phone IS NOT NULL
        AND public.normalize_bd_phone(o.customer_phone) = public.normalize_bd_phone(p.phone))
     OR (o.customer_email IS NOT NULL AND p.email IS NOT NULL
        AND lower(o.customer_email) = lower(p.email))
   );

UPDATE public.incomplete_checkouts ic
   SET user_id = p.id
  FROM public.profiles p
 WHERE ic.user_id IS NULL
   AND (
     (ic.customer_phone IS NOT NULL AND p.phone IS NOT NULL
        AND public.normalize_bd_phone(ic.customer_phone) = public.normalize_bd_phone(p.phone))
     OR (ic.customer_email IS NOT NULL AND p.email IS NOT NULL
        AND lower(ic.customer_email) = lower(p.email))
   );

-- 6) Rebuild CRM views
DROP VIEW IF EXISTS public.crm_customers;
CREATE VIEW public.crm_customers
WITH (security_invoker=on) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.student_id,
  p.created_at AS signed_up_at,
  COALESCE(o.order_count, 0) AS order_count,
  COALESCE(o.total_spent, 0::numeric) AS total_spent,
  o.first_order_at,
  o.last_order_at,
  COALESCE(e.active_enrollments, 0) AS active_enrollments,
  COALESCE(e.total_enrollments, 0) AS total_enrollments,
  CASE
    WHEN (COALESCE(o.order_count, 0) > 0 OR COALESCE(e.active_enrollments, 0) > 0)
      THEN 'active'::text
    ELSE 'signed_no_purchase'::text
  END AS segment
FROM public.profiles p
JOIN public.user_roles ur
  ON ur.user_id = p.id AND ur.role = 'student'::app_role
LEFT JOIN LATERAL (
  SELECT (count(*))::integer AS order_count,
         sum(orders.total_bdt) AS total_spent,
         min(orders.created_at) AS first_order_at,
         max(orders.created_at) AS last_order_at
    FROM public.orders
   WHERE orders.user_id = p.id
     AND orders.status <> ALL (ARRAY['cancelled','incomplete','hold'])
) o ON true
LEFT JOIN LATERAL (
  SELECT (count(*) FILTER (
             WHERE lms_enrollments.expires_at IS NULL
                OR lms_enrollments.expires_at > now()))::integer AS active_enrollments,
         (count(*))::integer AS total_enrollments
    FROM public.lms_enrollments
   WHERE lms_enrollments.user_id = p.id
) e ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur2
   WHERE ur2.user_id = p.id
     AND ur2.role = ANY (ARRAY['employee'::app_role, 'instructor'::app_role, 'super_admin'::app_role])
);

DROP VIEW IF EXISTS public.crm_guest_purchased;
CREATE VIEW public.crm_guest_purchased
WITH (security_invoker=on) AS
WITH guest_orders AS (
  SELECT
    o.customer_phone AS phone,
    o.customer_email AS email,
    o.customer_name  AS name,
    o.id AS order_id,
    o.total_bdt,
    o.created_at
  FROM public.orders o
  WHERE o.user_id IS NULL
    AND o.status <> ALL (ARRAY['cancelled','incomplete','hold'])
)
SELECT
  phone,
  (array_agg(DISTINCT email) FILTER (WHERE email IS NOT NULL))[1] AS email,
  (array_agg(name ORDER BY created_at DESC))[1] AS name,
  (count(*))::integer AS order_count,
  sum(total_bdt) AS total_spent,
  min(created_at) AS first_order_at,
  max(created_at) AS last_order_at
FROM guest_orders go
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p
   WHERE (public.normalize_bd_phone(p.phone) IS NOT NULL
          AND public.normalize_bd_phone(p.phone) = public.normalize_bd_phone(go.phone))
      OR (p.email IS NOT NULL AND go.email IS NOT NULL
          AND lower(p.email) = lower(go.email))
)
GROUP BY phone;

DROP VIEW IF EXISTS public.crm_incomplete_leads;
CREATE VIEW public.crm_incomplete_leads
WITH (security_invoker=on) AS
SELECT
  id,
  customer_phone AS phone,
  customer_email AS email,
  customer_name  AS name,
  division, district, thana,
  subtotal_bdt, total_bdt,
  attempt_count, last_outcome,
  first_attempt_at, last_attempt_at,
  cart
FROM public.incomplete_checkouts ic
WHERE user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE (public.normalize_bd_phone(p.phone) IS NOT NULL
            AND public.normalize_bd_phone(p.phone) = public.normalize_bd_phone(ic.customer_phone))
        OR (p.email IS NOT NULL AND ic.customer_email IS NOT NULL
            AND lower(p.email) = lower(ic.customer_email))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.user_id IS NULL
       AND public.normalize_bd_phone(o.customer_phone) = public.normalize_bd_phone(ic.customer_phone)
       AND o.status <> ALL (ARRAY['cancelled','incomplete','hold'])
  );

GRANT SELECT ON public.crm_customers TO authenticated;
GRANT SELECT ON public.crm_customers TO service_role;
GRANT SELECT ON public.crm_guest_purchased TO authenticated;
GRANT SELECT ON public.crm_guest_purchased TO service_role;
GRANT SELECT ON public.crm_incomplete_leads TO authenticated;
GRANT SELECT ON public.crm_incomplete_leads TO service_role;
