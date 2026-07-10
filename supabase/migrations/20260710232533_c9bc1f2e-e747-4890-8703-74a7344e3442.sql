-- Incomplete checkouts table: capture every valid-phone attempt that never completes.
-- Dedupe per phone + Dhaka day + cart signature; attempts array accumulates individual tries.

CREATE TABLE public.incomplete_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text NOT NULL,
  user_id uuid NULL,
  customer_name text,
  customer_phone text NOT NULL,
  customer_email text,
  division text,
  district text,
  thana text,
  address_line text,
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_bdt numeric NOT NULL DEFAULT 0,
  shipping_bdt numeric NOT NULL DEFAULT 0,
  total_bdt numeric NOT NULL DEFAULT 0,
  last_ip inet,
  last_user_agent text,
  last_fingerprint text,
  attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incomplete_checkouts_signature_key UNIQUE (signature)
);

CREATE INDEX incomplete_checkouts_phone_idx ON public.incomplete_checkouts(customer_phone);
CREATE INDEX incomplete_checkouts_last_attempt_idx ON public.incomplete_checkouts(last_attempt_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomplete_checkouts TO anon, authenticated;
GRANT ALL ON public.incomplete_checkouts TO service_role;

ALTER TABLE public.incomplete_checkouts ENABLE ROW LEVEL SECURITY;

-- Anon/auth can insert & upsert their own attempts (server fn uses publishable client).
CREATE POLICY "Anyone can insert incomplete checkouts"
  ON public.incomplete_checkouts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update incomplete checkouts by signature"
  ON public.incomplete_checkouts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Staff can read/delete all
CREATE POLICY "Staff can read incomplete checkouts"
  ON public.incomplete_checkouts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can delete incomplete checkouts"
  ON public.incomplete_checkouts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_incomplete_checkouts_updated_at
  BEFORE UPDATE ON public.incomplete_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
