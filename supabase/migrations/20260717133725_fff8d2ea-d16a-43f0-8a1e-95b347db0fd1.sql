ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_profiles;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.internal_profiles REPLICA IDENTITY FULL;