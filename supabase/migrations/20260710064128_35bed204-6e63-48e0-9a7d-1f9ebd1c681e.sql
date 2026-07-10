GRANT SELECT, INSERT, DELETE ON public.webauthn_challenges TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webauthn_challenges'
      AND policyname = 'Users create own passkey challenges'
  ) THEN
    CREATE POLICY "Users create own passkey challenges"
      ON public.webauthn_challenges
      FOR INSERT
      TO authenticated
      WITH CHECK (purpose = 'register' AND auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webauthn_challenges'
      AND policyname = 'Users read own passkey challenges'
  ) THEN
    CREATE POLICY "Users read own passkey challenges"
      ON public.webauthn_challenges
      FOR SELECT
      TO authenticated
      USING (purpose = 'register' AND auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webauthn_challenges'
      AND policyname = 'Users delete own passkey challenges'
  ) THEN
    CREATE POLICY "Users delete own passkey challenges"
      ON public.webauthn_challenges
      FOR DELETE
      TO authenticated
      USING (purpose = 'register' AND auth.uid() = user_id);
  END IF;
END $$;