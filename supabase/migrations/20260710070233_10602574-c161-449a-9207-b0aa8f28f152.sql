-- Sessions table for 2-device limit + real session tracking
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  device_label text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_sessions_user_id_idx ON public.user_sessions(user_id);
CREATE INDEX user_sessions_last_seen_idx ON public.user_sessions(user_id, last_seen_at DESC);

GRANT SELECT, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions" ON public.user_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- inserts happen server-side via service_role only (2-device gating logic)
