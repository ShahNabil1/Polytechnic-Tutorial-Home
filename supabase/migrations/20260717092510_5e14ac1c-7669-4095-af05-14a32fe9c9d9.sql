DROP VIEW IF EXISTS public.crm_incomplete_leads;

CREATE VIEW public.crm_incomplete_leads
WITH (security_invoker = true)
AS
SELECT
  ('checkout:' || ic.id::text) AS id,
  ic.customer_phone AS phone,
  ic.customer_email AS email,
  ic.customer_name AS name,
  ic.division,
  ic.district,
  ic.thana,
  ic.subtotal_bdt,
  ic.total_bdt,
  ic.attempt_count,
  ic.last_outcome,
  ic.first_attempt_at,
  ic.last_attempt_at,
  ic.cart,
  'checkout'::text AS source
FROM public.incomplete_checkouts ic
WHERE ic.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE (public.normalize_bd_phone(p.phone) IS NOT NULL
             AND public.normalize_bd_phone(p.phone) = public.normalize_bd_phone(ic.customer_phone))
        OR (p.email IS NOT NULL AND ic.customer_email IS NOT NULL
             AND lower(p.email) = lower(ic.customer_email))
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE public.normalize_bd_phone(o.customer_phone) = public.normalize_bd_phone(ic.customer_phone)
  )

UNION ALL

SELECT
  ('order:' || o.id::text) AS id,
  o.customer_phone AS phone,
  o.customer_email AS email,
  o.customer_name AS name,
  o.division,
  o.district,
  o.thana,
  o.subtotal_bdt,
  o.total_bdt,
  1 AS attempt_count,
  'order_incomplete'::text AS last_outcome,
  o.created_at AS first_attempt_at,
  o.updated_at AS last_attempt_at,
  NULL::jsonb AS cart,
  'order'::text AS source
FROM public.orders o
WHERE o.status = 'incomplete';

GRANT SELECT ON public.crm_incomplete_leads TO authenticated, service_role;