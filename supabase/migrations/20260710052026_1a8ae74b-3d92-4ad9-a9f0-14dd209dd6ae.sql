-- pg_graphql requires SELECT on the primary-key column at table scope to expose the type.
-- Column-level SELECT (even on the PK) does not satisfy pg_graphql's introspection check,
-- so re-issuing column grants without a table-scope SELECT hides the table from GraphQL
-- while keeping PostgREST fully functional for row reads/writes under RLS.
REVOKE ALL ON public.profiles FROM anon, authenticated, PUBLIC;

GRANT SELECT (id, email, full_name, phone, phone_verified, avatar_url, created_at, updated_at),
      INSERT (id, email, full_name, phone, phone_verified, avatar_url),
      UPDATE (email, full_name, phone, phone_verified, avatar_url),
      DELETE
  ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;