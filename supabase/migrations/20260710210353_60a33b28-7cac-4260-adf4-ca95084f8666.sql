
-- ============ product_categories ============
CREATE TYPE public.product_category_kind AS ENUM ('product_type','department','semester');

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.product_category_kind NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" ON public.product_categories
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can insert categories" ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can update categories" ON public.product_categories
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_products'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can delete categories" ON public.product_categories
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_products'));

CREATE TRIGGER trg_product_categories_updated
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ products ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  compare_price NUMERIC(10,2),
  product_type_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  og_image_url TEXT,
  meta_title TEXT,
  meta_description TEXT,
  stock INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_type ON public.products(product_type_id);
CREATE INDEX idx_products_active ON public.products(is_active);

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true OR public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_products'))
  WITH CHECK (public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_products'));

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ product_subcategories (M2M) ============
CREATE TABLE public.product_subcategories (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_psub_category ON public.product_subcategories(category_id);

GRANT SELECT ON public.product_subcategories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_subcategories TO authenticated;
GRANT ALL ON public.product_subcategories TO service_role;

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product subcategories" ON public.product_subcategories
  FOR SELECT USING (true);

CREATE POLICY "Managers can insert product subcategories" ON public.product_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'manage_products'));

CREATE POLICY "Managers can delete product subcategories" ON public.product_subcategories
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'manage_products'));

-- ============ Seed initial categories ============
INSERT INTO public.product_categories (kind, slug, name, sort_order) VALUES
  ('product_type','physical','Physical Book',1),
  ('product_type','ebook','E-Book',2),
  ('product_type','suggestion','Super Suggestion',3),
  ('department','computer','Computer',1),
  ('department','civil','Civil',2),
  ('department','electrical','Electrical',3),
  ('department','mechanical','Mechanical',4),
  ('department','electronics','Electronics',5),
  ('semester','1','1st Semester',1),
  ('semester','2','2nd Semester',2),
  ('semester','3','3rd Semester',3),
  ('semester','4','4th Semester',4),
  ('semester','5','5th Semester',5),
  ('semester','6','6th Semester',6),
  ('semester','7','7th Semester',7),
  ('semester','8','8th Semester',8);
