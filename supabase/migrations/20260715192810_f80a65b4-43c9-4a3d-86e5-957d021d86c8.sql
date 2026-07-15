
DROP VIEW IF EXISTS public.crm_customers CASCADE;
DROP VIEW IF EXISTS public.crm_guest_purchased CASCADE;
DROP VIEW IF EXISTS public.crm_incomplete_leads CASCADE;

CREATE VIEW public.crm_customers
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.created_at AS signed_up_at,
  COALESCE(o.order_count, 0)::int AS order_count,
  COALESCE(o.total_spent, 0)::numeric AS total_spent,
  o.first_order_at,
  o.last_order_at,
  COALESCE(e.active_enrollments, 0)::int AS active_enrollments,
  COALESCE(e.total_enrollments, 0)::int AS total_enrollments,
  CASE
    WHEN COALESCE(o.order_count, 0) > 0 OR COALESCE(e.active_enrollments, 0) > 0
      THEN 'active'
    ELSE 'signed_no_purchase'
  END AS segment
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'student'
LEFT JOIN LATERAL (
  SELECT count(*)::int AS order_count, sum(total_bdt)::numeric AS total_spent,
         min(created_at) AS first_order_at, max(created_at) AS last_order_at
  FROM public.orders
  WHERE user_id = p.id AND status NOT IN ('cancelled','incomplete','hold')
) o ON true
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE expires_at IS NULL OR expires_at > now())::int AS active_enrollments,
         count(*)::int AS total_enrollments
  FROM public.lms_enrollments WHERE user_id = p.id
) e ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur2
  WHERE ur2.user_id = p.id AND ur2.role IN ('employee','instructor','super_admin')
);

GRANT SELECT ON public.crm_customers TO authenticated, service_role;

CREATE VIEW public.crm_guest_purchased
WITH (security_invoker = true) AS
WITH guest_orders AS (
  SELECT o.customer_phone AS phone, o.customer_email AS email, o.customer_name AS name,
         o.id AS order_id, o.total_bdt, o.created_at
  FROM public.orders o
  WHERE o.user_id IS NULL AND o.status NOT IN ('cancelled','incomplete','hold')
)
SELECT
  go.phone,
  (array_agg(DISTINCT go.email) FILTER (WHERE go.email IS NOT NULL))[1] AS email,
  (array_agg(go.name ORDER BY go.created_at DESC))[1] AS name,
  count(*)::int AS order_count,
  sum(go.total_bdt)::numeric AS total_spent,
  min(go.created_at) AS first_order_at,
  max(go.created_at) AS last_order_at
FROM guest_orders go
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.phone = go.phone
     OR (p.email IS NOT NULL AND go.email IS NOT NULL AND lower(p.email) = lower(go.email))
)
GROUP BY go.phone;

GRANT SELECT ON public.crm_guest_purchased TO authenticated, service_role;

CREATE VIEW public.crm_incomplete_leads
WITH (security_invoker = true) AS
SELECT
  ic.id, ic.customer_phone AS phone, ic.customer_email AS email, ic.customer_name AS name,
  ic.division, ic.district, ic.thana,
  ic.subtotal_bdt, ic.total_bdt, ic.attempt_count, ic.last_outcome,
  ic.first_attempt_at, ic.last_attempt_at, ic.cart
FROM public.incomplete_checkouts ic
WHERE ic.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.phone = ic.customer_phone
       OR (p.email IS NOT NULL AND ic.customer_email IS NOT NULL AND lower(p.email) = lower(ic.customer_email))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id IS NULL AND o.customer_phone = ic.customer_phone
      AND o.status NOT IN ('cancelled','incomplete','hold')
  );

GRANT SELECT ON public.crm_incomplete_leads TO authenticated, service_role;
