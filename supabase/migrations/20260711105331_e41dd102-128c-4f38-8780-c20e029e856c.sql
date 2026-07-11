
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS steadfast_last_error text,
  ADD COLUMN IF NOT EXISTS steadfast_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steadfast_delivery_status text,
  ADD COLUMN IF NOT EXISTS steadfast_status_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.steadfast_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  consignment_id text,
  tracking_code text,
  invoice text,
  status text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sf_events_order ON public.steadfast_status_events(order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_events_consignment ON public.steadfast_status_events(consignment_id);
CREATE INDEX IF NOT EXISTS idx_sf_events_invoice ON public.steadfast_status_events(invoice);

GRANT SELECT ON public.steadfast_status_events TO authenticated;
GRANT ALL ON public.steadfast_status_events TO service_role;

ALTER TABLE public.steadfast_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read steadfast events"
  ON public.steadfast_status_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'employee')
  );
