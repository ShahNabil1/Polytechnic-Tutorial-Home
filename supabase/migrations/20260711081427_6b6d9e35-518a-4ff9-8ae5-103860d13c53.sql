
-- Staff server fns query these as the signed-in user via requireSupabaseAuth;
-- RLS policies already gate access to employees / super_admin. Grant back
-- minimum privileges (SELECT for reads; INSERT/UPDATE/DELETE where policies allow).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_identifiers  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_internal_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomplete_checkouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_profiles    TO authenticated;
GRANT SELECT ON public.user_permissions TO authenticated;

-- Staff also insert/update/delete order rows (status transitions, bulk actions).
GRANT INSERT, UPDATE, DELETE ON public.orders      TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
