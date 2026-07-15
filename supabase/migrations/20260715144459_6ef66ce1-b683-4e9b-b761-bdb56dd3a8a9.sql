GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_challenges TO authenticated;
GRANT ALL ON public.webauthn_challenges TO service_role;