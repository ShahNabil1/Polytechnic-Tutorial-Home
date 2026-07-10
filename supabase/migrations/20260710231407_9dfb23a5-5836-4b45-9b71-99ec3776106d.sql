
-- Sequence + generator for order numbers
CREATE SEQUENCE IF NOT EXISTS public.order_no_seq START 1;

CREATE OR REPLACE FUNCTION public.next_order_no()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'PTH' || lpad(nextval('public.order_no_seq')::text, 3, '0');
$$;

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  alternative_phone text,
  division text,
  district text,
  thana text,
  address_line text,
  full_address text,
  subtotal_bdt numeric(12,2) NOT NULL DEFAULT 0,
  shipping_bdt numeric(12,2) NOT NULL DEFAULT 0,
  discount_bdt numeric(12,2) NOT NULL DEFAULT 0,
  total_bdt numeric(12,2) NOT NULL DEFAULT 0,
  cod_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'paid',
  payment_method text,
  status text NOT NULL DEFAULT 'processing',
  order_type text NOT NULL DEFAULT 'physical',
  has_physical boolean NOT NULL DEFAULT true,
  delivery_type smallint NOT NULL DEFAULT 0,
  note text,
  item_description text,
  ip inet,
  user_agent text,
  device_fingerprint text,
  steadfast_consignment_id text,
  steadfast_tracking_code text,
  steadfast_status text,
  steadfast_synced_at timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('processing','ready_to_ship','shipped','hold','delivered','cancelled','returned','incomplete')),
  CONSTRAINT orders_type_check CHECK (order_type IN ('physical','ebook','mixed'))
);

CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_user_idx ON public.orders(user_id);
CREATE INDEX orders_created_idx ON public.orders(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
GRANT USAGE ON SEQUENCE public.order_no_seq TO authenticated, anon, service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Staff can delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  bundle_id uuid,
  is_bundle boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  sku text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  item_type text NOT NULL DEFAULT 'physical',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_type_check CHECK (item_type IN ('physical','ebook'))
);

CREATE INDEX order_items_order_idx ON public.order_items(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO anon;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all order items" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Staff can modify order items" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

-- INTERNAL NOTES
CREATE TABLE public.order_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_internal_notes_order_idx ON public.order_internal_notes(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_internal_notes TO authenticated;
GRANT ALL ON public.order_internal_notes TO service_role;

ALTER TABLE public.order_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read internal notes" ON public.order_internal_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Staff can add internal notes" ON public.order_internal_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Staff can delete internal notes" ON public.order_internal_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- STATUS HISTORY
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON public.order_status_history(order_id);

GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view status history" ON public.order_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Staff can insert status history" ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

-- BLOCKED IDENTIFIERS
CREATE TABLE public.blocked_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  value text NOT NULL,
  reason text,
  blocked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value),
  CONSTRAINT blocked_kind_check CHECK (kind IN ('ip','fingerprint','phone'))
);
CREATE INDEX blocked_identifiers_lookup_idx ON public.blocked_identifiers(kind, value);

GRANT SELECT, INSERT, DELETE ON public.blocked_identifiers TO authenticated;
GRANT ALL ON public.blocked_identifiers TO service_role;

ALTER TABLE public.blocked_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage blocklist" ON public.blocked_identifiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));
