-- Replace table-level SELECT with column-level SELECT.
-- PostgREST supports column-level privileges; pg_graphql requires table-level SELECT to expose the type.
REVOKE SELECT ON public.profiles FROM anon, authenticated, PUBLIC;

GRANT SELECT (id, email, full_name, phone, phone_verified, avatar_url, created_at, updated_at)
  ON public.profiles TO authenticated;