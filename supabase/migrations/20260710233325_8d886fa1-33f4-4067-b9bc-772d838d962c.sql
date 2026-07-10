
ALTER TABLE public.incomplete_checkouts
  ADD COLUMN IF NOT EXISTS last_outcome text NOT NULL DEFAULT 'abandoned';

CREATE INDEX IF NOT EXISTS incomplete_checkouts_last_outcome_idx
  ON public.incomplete_checkouts(last_outcome);

CREATE OR REPLACE FUNCTION public.record_incomplete_attempt(
  _signature text,
  _user_id uuid,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _division text,
  _district text,
  _thana text,
  _address_line text,
  _cart jsonb,
  _subtotal numeric,
  _shipping numeric,
  _total numeric,
  _ip text,
  _user_agent text,
  _fingerprint text,
  _outcome text,
  _gateway_ref text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
  ip_val inet := NULLIF(_ip, '')::inet;
  outcome_val text := COALESCE(NULLIF(_outcome, ''), 'abandoned');
  attempt jsonb := jsonb_build_object(
    'at', now_ts,
    'ip', NULLIF(_ip, ''),
    'fingerprint', NULLIF(_fingerprint, ''),
    'user_agent', NULLIF(_user_agent, ''),
    'outcome', outcome_val,
    'gateway_ref', NULLIF(_gateway_ref, '')
  );
  result_id uuid;
BEGIN
  INSERT INTO public.incomplete_checkouts (
    signature, user_id, customer_name, customer_phone, customer_email,
    division, district, thana, address_line, cart,
    subtotal_bdt, shipping_bdt, total_bdt,
    last_ip, last_user_agent, last_fingerprint,
    attempts, attempt_count, first_attempt_at, last_attempt_at, last_outcome
  ) VALUES (
    _signature, _user_id, NULLIF(_customer_name, ''), _customer_phone, NULLIF(_customer_email, ''),
    NULLIF(_division, ''), NULLIF(_district, ''), NULLIF(_thana, ''), NULLIF(_address_line, ''),
    COALESCE(_cart, '[]'::jsonb),
    COALESCE(_subtotal, 0), COALESCE(_shipping, 0), COALESCE(_total, 0),
    ip_val, NULLIF(_user_agent, ''), NULLIF(_fingerprint, ''),
    jsonb_build_array(attempt), 1, now_ts, now_ts, outcome_val
  )
  ON CONFLICT (signature) DO UPDATE
    SET attempts = (
          CASE WHEN jsonb_array_length(public.incomplete_checkouts.attempts) >= 50
               THEN (public.incomplete_checkouts.attempts - 0) || attempt
               ELSE public.incomplete_checkouts.attempts || attempt
          END
        ),
        attempt_count = public.incomplete_checkouts.attempt_count + 1,
        last_attempt_at = now_ts,
        last_outcome = outcome_val,
        customer_name = COALESCE(NULLIF(_customer_name, ''), public.incomplete_checkouts.customer_name),
        customer_email = COALESCE(NULLIF(_customer_email, ''), public.incomplete_checkouts.customer_email),
        division = COALESCE(NULLIF(_division, ''), public.incomplete_checkouts.division),
        district = COALESCE(NULLIF(_district, ''), public.incomplete_checkouts.district),
        thana = COALESCE(NULLIF(_thana, ''), public.incomplete_checkouts.thana),
        address_line = COALESCE(NULLIF(_address_line, ''), public.incomplete_checkouts.address_line),
        subtotal_bdt = COALESCE(_subtotal, public.incomplete_checkouts.subtotal_bdt),
        shipping_bdt = COALESCE(_shipping, public.incomplete_checkouts.shipping_bdt),
        total_bdt = COALESCE(_total, public.incomplete_checkouts.total_bdt),
        last_ip = COALESCE(ip_val, public.incomplete_checkouts.last_ip),
        last_user_agent = COALESCE(NULLIF(_user_agent, ''), public.incomplete_checkouts.last_user_agent),
        last_fingerprint = COALESCE(NULLIF(_fingerprint, ''), public.incomplete_checkouts.last_fingerprint),
        cart = COALESCE(_cart, public.incomplete_checkouts.cart),
        user_id = COALESCE(_user_id, public.incomplete_checkouts.user_id),
        updated_at = now_ts
    RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_incomplete_attempt(text,uuid,text,text,text,text,text,text,text,jsonb,numeric,numeric,numeric,text,text,text,text,text)
  TO anon, authenticated, service_role;
