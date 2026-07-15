
-- Enable pg_cron for background cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Server-side revoke: verify caller owns the tracked session, then delete
-- the auth.sessions row (invalidates JWT/refresh token immediately) and the
-- public.user_sessions tracking row atomically.
CREATE OR REPLACE FUNCTION public.revoke_user_session(_tracked_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_token_hash text;
  v_auth_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id, session_token_hash
    INTO v_user_id, v_token_hash
  FROM public.user_sessions
  WHERE id = _tracked_id;

  IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
    RETURN false;
  END IF;

  -- session_token_hash stores the auth session id (uuid) from JWT sid claim
  BEGIN
    v_auth_session_id := v_token_hash::uuid;
  EXCEPTION WHEN others THEN
    v_auth_session_id := NULL;
  END;

  IF v_auth_session_id IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE session_id = v_auth_session_id;
    DELETE FROM auth.sessions WHERE id = v_auth_session_id;
  END IF;

  DELETE FROM public.user_sessions WHERE id = _tracked_id AND user_id = auth.uid();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid) TO authenticated;

-- Bulk revoke: all other sessions for the caller (keeps the current one)
CREATE OR REPLACE FUNCTION public.revoke_other_user_sessions(_current_token_hash text)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR r IN
    SELECT id, session_token_hash
    FROM public.user_sessions
    WHERE user_id = auth.uid()
      AND session_token_hash <> _current_token_hash
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

  DELETE FROM public.user_sessions
   WHERE user_id = auth.uid()
     AND session_token_hash <> _current_token_hash;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_other_user_sessions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_other_user_sessions(text) TO authenticated;

-- Background auto-cleanup: prunes stuck/orphaned sessions.
-- Safe to run frequently; only touches rows that are clearly abandoned.
CREATE OR REPLACE FUNCTION public.cleanup_stuck_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_orphaned integer := 0;
  v_stale integer := 0;
  v_expired_auth integer := 0;
BEGIN
  -- 1) Tracked rows whose auth session no longer exists (already signed out
  --    server-side but tracking row leaked).
  WITH del AS (
    DELETE FROM public.user_sessions us
     WHERE NOT EXISTS (
       SELECT 1 FROM auth.sessions s
        WHERE s.id::text = us.session_token_hash
     )
     RETURNING 1
  )
  SELECT count(*) INTO v_orphaned FROM del;

  -- 2) Tracked rows idle for 30+ days (client never pinged back).
  WITH del AS (
    DELETE FROM public.user_sessions
     WHERE last_seen_at < now() - interval '30 days'
     RETURNING 1
  )
  SELECT count(*) INTO v_stale FROM del;

  -- 3) Auth sessions that have not refreshed in 60+ days (stuck / abandoned).
  --    Supabase normally rotates these; anything this old is dead weight.
  WITH del AS (
    DELETE FROM auth.sessions
     WHERE COALESCE(refreshed_at, created_at) < now() - interval '60 days'
     RETURNING 1
  )
  SELECT count(*) INTO v_expired_auth FROM del;

  RETURN jsonb_build_object(
    'orphaned_tracked', v_orphaned,
    'stale_tracked', v_stale,
    'expired_auth', v_expired_auth,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stuck_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stuck_sessions() TO service_role;

-- Schedule: every 10 minutes.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-sessions') THEN
    PERFORM cron.unschedule('cleanup-stuck-sessions');
  END IF;
  PERFORM cron.schedule(
    'cleanup-stuck-sessions',
    '*/10 * * * *',
    $cron$ SELECT public.cleanup_stuck_sessions(); $cron$
  );
END $$;
