-- Security-definer function to create an auth.sessions row for passkey sign-in.
-- Called via PostgREST RPC from the SSR worker (Cloudflare Workers can't
-- reliably hold direct TCP connections to Postgres).
CREATE OR REPLACE FUNCTION public.create_passkey_auth_session(
  _user_id uuid,
  _user_agent text,
  _ip text,
  _refresh_token_hmac_key text,
  _refresh_token_counter int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  new_session_id uuid := gen_random_uuid();
  now_ts timestamptz := now();
BEGIN
  INSERT INTO auth.sessions (
    id, user_id, aal, created_at, updated_at, refreshed_at,
    user_agent, ip, refresh_token_hmac_key, refresh_token_counter
  ) VALUES (
    new_session_id,
    _user_id,
    'aal1'::auth.aal_level,
    now_ts,
    now_ts,
    now_ts::timestamp,
    COALESCE(_user_agent, 'passkey'),
    NULLIF(_ip, '')::inet,
    _refresh_token_hmac_key,
    _refresh_token_counter
  );

  UPDATE auth.users
     SET last_sign_in_at = now_ts,
         updated_at = now_ts
   WHERE id = _user_id;

  RETURN new_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, int) TO service_role;
