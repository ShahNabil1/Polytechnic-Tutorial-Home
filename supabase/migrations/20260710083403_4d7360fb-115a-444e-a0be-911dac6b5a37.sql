REVOKE ALL ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_passkey_auth_session(uuid, text, text, text, integer) TO service_role;