ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.incomplete_checkouts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incomplete_checkouts;