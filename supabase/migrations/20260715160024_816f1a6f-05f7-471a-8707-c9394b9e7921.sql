CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.impersonation_sessions TO service_role;

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX impersonation_sessions_target_idx
  ON public.impersonation_sessions(target_user_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.admin_revoke_user_session(_target_user_id uuid, _tracked_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_token_hash text;
  v_auth_session_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'manage_users') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own session here';
  END IF;

  IF public.has_role(_target_user_id, 'super_admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT session_token_hash
    INTO v_token_hash
  FROM public.user_sessions
  WHERE id = _tracked_id
    AND user_id = _target_user_id;

  IF v_token_hash IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_auth_session_id := v_token_hash::uuid;
  EXCEPTION WHEN others THEN
    v_auth_session_id := NULL;
  END;

  IF v_auth_session_id IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE session_id = v_auth_session_id;
    DELETE FROM auth.sessions WHERE id = v_auth_session_id;
  END IF;

  DELETE FROM public.user_sessions
   WHERE id = _tracked_id
     AND user_id = _target_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_user_session(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_session(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_all_user_sessions(_target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_sid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), 'manage_users') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own sessions here';
  END IF;

  IF public.has_role(_target_user_id, 'super_admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR r IN
    SELECT id, session_token_hash
    FROM public.user_sessions
    WHERE user_id = _target_user_id
  LOOP
    BEGIN
      v_sid := r.session_token_hash::uuid;
      DELETE FROM auth.refresh_tokens WHERE session_id = v_sid;
      DELETE FROM auth.sessions WHERE id = v_sid;
    EXCEPTION WHEN others THEN
      NULL;
    END;
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.user_sessions WHERE user_id = _target_user_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_all_user_sessions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_all_user_sessions(uuid) TO authenticated;