ALTER TABLE public.webauthn_credentials
  ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS webauthn_credentials_phone_idx
  ON public.webauthn_credentials(phone)
  WHERE phone IS NOT NULL;

GRANT INSERT ON public.webauthn_credentials TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webauthn_credentials'
      AND policyname = 'Users create own passkeys'
  ) THEN
    CREATE POLICY "Users create own passkeys"
      ON public.webauthn_credentials
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;