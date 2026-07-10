
-- 1. Add SKU to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;

-- Backfill unique random SKUs for existing rows
UPDATE public.products
SET sku = 'PTH-' || upper(substring(replace(gen_random_uuid()::text,'-',''),1,10))
WHERE sku IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products(sku);

-- 2. product_bundles
CREATE TABLE IF NOT EXISTS public.product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_price NUMERIC(12,2),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  og_image_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_bundles TO authenticated;
GRANT ALL ON public.product_bundles TO service_role;

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bundles" ON public.product_bundles
  FOR SELECT USING (is_active = true OR has_permission(auth.uid(), 'manage_products'));
CREATE POLICY "Managers can insert bundles" ON public.product_bundles
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'manage_products'));
CREATE POLICY "Managers can update bundles" ON public.product_bundles
  FOR UPDATE USING (has_permission(auth.uid(), 'manage_products'))
  WITH CHECK (has_permission(auth.uid(), 'manage_products'));
CREATE POLICY "Managers can delete bundles" ON public.product_bundles
  FOR DELETE USING (has_permission(auth.uid(), 'manage_products'));

CREATE TRIGGER update_product_bundles_updated_at
  BEFORE UPDATE ON public.product_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. product_bundle_items
CREATE TABLE IF NOT EXISTS public.product_bundle_items (
  bundle_id UUID NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

GRANT SELECT ON public.product_bundle_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_bundle_items TO authenticated;
GRANT ALL ON public.product_bundle_items TO service_role;

ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundle items" ON public.product_bundle_items
  FOR SELECT USING (true);
CREATE POLICY "Managers can insert bundle items" ON public.product_bundle_items
  FOR INSERT WITH CHECK (has_permission(auth.uid(), 'manage_products'));
CREATE POLICY "Managers can update bundle items" ON public.product_bundle_items
  FOR UPDATE USING (has_permission(auth.uid(), 'manage_products'))
  WITH CHECK (has_permission(auth.uid(), 'manage_products'));
CREATE POLICY "Managers can delete bundle items" ON public.product_bundle_items
  FOR DELETE USING (has_permission(auth.uid(), 'manage_products'));
