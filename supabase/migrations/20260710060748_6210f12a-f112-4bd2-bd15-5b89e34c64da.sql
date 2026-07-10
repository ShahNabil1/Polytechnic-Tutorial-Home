-- 1) WebAuthn credentials
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT ARRAY[]::text[],
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX webauthn_credentials_user_id_idx ON public.webauthn_credentials(user_id);

GRANT SELECT, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys"
  ON public.webauthn_credentials FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own passkeys"
  ON public.webauthn_credentials FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) WebAuthn challenges (server-only)
CREATE TABLE public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL UNIQUE,
  user_id uuid,
  phone text,
  purpose text NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webauthn_challenges_phone_idx ON public.webauthn_challenges(phone) WHERE phone IS NOT NULL;
CREATE INDEX webauthn_challenges_user_idx ON public.webauthn_challenges(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX webauthn_challenges_expires_idx ON public.webauthn_challenges(expires_at);

GRANT ALL ON public.webauthn_challenges TO service_role;

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated = fully locked to service_role only.