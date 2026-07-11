
-- 1) Drop insecure permissive policies on orders / order_items / incomplete_checkouts
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert incomplete checkouts" ON public.incomplete_checkouts;
DROP POLICY IF EXISTS "Anyone can update incomplete checkouts by signature" ON public.incomplete_checkouts;

-- All writes to these tables now flow through server functions using the service_role
-- client (which bypasses RLS). Public roles have no direct INSERT/UPDATE path.

-- 2) Revoke ALL privileges from anon on sensitive tables (removes them from anon GraphQL schema
--    and closes any direct anon Data API access). All anon reads/writes go through server fns.
REVOKE ALL ON public.orders               FROM anon;
REVOKE ALL ON public.order_items          FROM anon;
REVOKE ALL ON public.order_status_history FROM anon;
REVOKE ALL ON public.order_internal_notes FROM anon;
REVOKE ALL ON public.incomplete_checkouts FROM anon;
REVOKE ALL ON public.blocked_identifiers  FROM anon;
REVOKE ALL ON public.internal_profiles    FROM anon;
REVOKE ALL ON public.user_permissions     FROM anon;
REVOKE ALL ON public.user_roles           FROM anon;
REVOKE ALL ON public.user_sessions        FROM anon;
REVOKE ALL ON public.webauthn_challenges  FROM anon;
REVOKE ALL ON public.webauthn_credentials FROM anon;
REVOKE ALL ON public.profiles             FROM anon;

-- 3) Restrict authenticated privileges on internal-only tables (admin/staff surfaces
--    still work: server fns use requireSupabaseAuth which acts as the signed-in user,
--    and admin flows use the service_role client). This hides them from the
--    authenticated GraphQL schema too.
REVOKE ALL ON public.blocked_identifiers  FROM authenticated;
REVOKE ALL ON public.order_internal_notes FROM authenticated;
REVOKE ALL ON public.order_status_history FROM authenticated;
REVOKE ALL ON public.incomplete_checkouts FROM authenticated;
REVOKE ALL ON public.internal_profiles    FROM authenticated;
REVOKE ALL ON public.user_permissions     FROM authenticated;
REVOKE ALL ON public.webauthn_challenges  FROM authenticated;
REVOKE ALL ON public.webauthn_credentials FROM authenticated;

-- Tables the browser client still touches as the signed-in user — keep minimum grants.
GRANT SELECT, UPDATE ON public.profiles      TO authenticated;
GRANT SELECT ON public.user_roles            TO authenticated; -- read own roles
GRANT SELECT ON public.orders                TO authenticated;
GRANT SELECT ON public.order_items           TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.user_sessions TO authenticated;

-- 4) Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER helpers.
--    Keep has_role / has_permission / get_primary_role callable so RLS policies work.
REVOKE EXECUTE ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_internal_display_id(app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_order_no() FROM anon, authenticated, PUBLIC;

-- Trigger functions should not be callable directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_internal_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_student_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- has_role, has_permission, get_primary_role: authenticated only (needed by RLS policies).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM anon, PUBLIC;

-- record_incomplete_attempt: needed by anon (guest capture flow via serverPublic).
-- Keep default grants for anon + authenticated.
