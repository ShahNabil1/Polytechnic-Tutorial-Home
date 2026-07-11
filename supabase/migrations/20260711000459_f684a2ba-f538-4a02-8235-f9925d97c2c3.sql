ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS source_detail text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_source_idx ON public.orders (source);
CREATE INDEX IF NOT EXISTS orders_created_by_user_id_idx ON public.orders (created_by_user_id);

COMMENT ON COLUMN public.orders.source IS 'Order attribution bucket: website | direct | manual | fb_utm | google | other. Populated from checkout UTM detection or set by staff for manual orders.';
COMMENT ON COLUMN public.orders.source_detail IS 'Free-form attribution detail (utm campaign / content / employee-chosen tag).';
COMMENT ON COLUMN public.orders.created_by_user_id IS 'For manual orders: the internal staff user who created the order.';