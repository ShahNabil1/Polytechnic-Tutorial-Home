GRANT INSERT ON public.user_sessions TO authenticated;

DROP POLICY IF EXISTS "Users insert own current session" ON public.user_sessions;
CREATE POLICY "Users insert own current session"
ON public.user_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND session_token_hash = COALESCE(
    auth.jwt() ->> 'session_id',
    auth.jwt() ->> 'sid',
    auth.jwt() ->> 'jti'
  )
);