
-- 1. Create separate LMS departments & semesters tables
CREATE TABLE public.lms_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_departments TO authenticated;
GRANT ALL ON public.lms_departments TO service_role;
ALTER TABLE public.lms_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_departments_read" ON public.lms_departments FOR SELECT USING (is_active OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms_departments_manage" ON public.lms_departments FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'manage_lms')) WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));
CREATE TRIGGER lms_departments_updated_at BEFORE UPDATE ON public.lms_departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lms_semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_semesters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_semesters TO authenticated;
GRANT ALL ON public.lms_semesters TO service_role;
ALTER TABLE public.lms_semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_semesters_read" ON public.lms_semesters FOR SELECT USING (is_active OR public.has_permission(auth.uid(), 'manage_lms'));
CREATE POLICY "lms_semesters_manage" ON public.lms_semesters FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'manage_lms')) WITH CHECK (public.has_permission(auth.uid(), 'manage_lms'));
CREATE TRIGGER lms_semesters_updated_at BEFORE UPDATE ON public.lms_semesters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed from existing product_categories data (preserve UUIDs for continuity)
INSERT INTO public.lms_departments (id, slug, name, sort_order, is_active) VALUES
  ('ca5605c0-b96f-4a10-acbd-8710087e8e89', 'computer', 'কম্পিউটার', 1, true),
  ('849be2ca-1493-4ec1-878c-51cbd4766b41', 'civil', 'সিভিল', 2, true),
  ('7c3ddd45-7c90-418b-ae5a-783339ec73e8', 'electrical', 'ইলেকট্রিক্যাল', 3, true),
  ('d54b0609-b167-4e3d-90b1-2986a369f656', 'mechanical', 'মেকানিক্যাল', 4, true),
  ('42091b2b-8da4-4eb9-a4aa-81fe2cf09512', 'electronics', 'ইলেকট্রনিক্স', 5, true);

INSERT INTO public.lms_semesters (id, slug, name, sort_order, is_active) VALUES
  ('d2542781-b3a4-4941-b71c-04f8ea2218fb', '1', '১ম সেমিস্টার', 1, true),
  ('9567c33b-3f0e-4730-befa-ad20de8f6834', '2', '২য় সেমিস্টার', 2, true),
  ('3f21ecfd-ab6e-48c8-850b-23207e8bc3ca', '3', '৩য় সেমিস্টার', 3, true),
  ('f00340dd-ca28-4c62-b792-2ea8d77591ea', '4', '৪র্থ সেমিস্টার', 4, true),
  ('3c9ec174-9f13-45f2-b2ed-09683c8c777f', '5', '৫ম সেমিস্টার', 5, true),
  ('fc839177-c7e6-41ce-a540-147ddb69b1cf', '6', '৬ষ্ঠ সেমিস্টার', 6, true),
  ('fbf713db-bb21-43fc-98ef-d704bee43cf3', '7', '৭ম সেমিস্টার', 7, true),
  ('34db8c80-cc52-483d-8e08-6899c9ffcce8', '8', '৮ম সেমিস্টার', 8, true);

-- 3. Repoint FKs on join tables from product_categories -> new lms_* tables
ALTER TABLE public.lms_subject_departments DROP CONSTRAINT IF EXISTS lms_subject_departments_category_id_fkey;
ALTER TABLE public.lms_subject_departments
  ADD CONSTRAINT lms_subject_departments_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.lms_departments(id) ON DELETE CASCADE;

ALTER TABLE public.lms_subject_semesters DROP CONSTRAINT IF EXISTS lms_subject_semesters_category_id_fkey;
ALTER TABLE public.lms_subject_semesters
  ADD CONSTRAINT lms_subject_semesters_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.lms_semesters(id) ON DELETE CASCADE;

-- 4. Seed test subjects with department/semester assignments
WITH new_subjects (id, name, code, slug, description, sort_order) AS (
  VALUES
    (gen_random_uuid(), 'Programming Fundamentals', 'CSE-1101', 'programming-fundamentals', 'Introduction to programming concepts using C.', 1),
    (gen_random_uuid(), 'Digital Electronics', 'CSE-1201', 'digital-electronics', 'Boolean algebra, logic gates and combinational circuits.', 2),
    (gen_random_uuid(), 'Structured Programming Language', 'CSE-1202', 'structured-programming-language', 'Advanced C programming and data handling.', 3),
    (gen_random_uuid(), 'Engineering Drawing', 'CIV-1101', 'engineering-drawing', 'Basics of engineering drawing and drafting for civil works.', 4),
    (gen_random_uuid(), 'Surveying', 'CIV-1201', 'surveying', 'Introduction to land surveying and instruments.', 5),
    (gen_random_uuid(), 'Basic Electrical Engineering', 'EEE-1101', 'basic-electrical-engineering', 'Fundamentals of electrical circuits and networks.', 6),
    (gen_random_uuid(), 'AC Machines', 'EEE-1201', 'ac-machines', 'Working principles of AC electrical machines.', 7),
    (gen_random_uuid(), 'বাংলা', 'GEN-1101', 'bangla', 'Bangla language and communication for polytechnic students.', 8),
    (gen_random_uuid(), 'English', 'GEN-1102', 'english', 'General English for technical students.', 9),
    (gen_random_uuid(), 'Physics-1', 'GEN-1103', 'physics-1', 'Foundational physics topics for 1st semester.', 10),
    (gen_random_uuid(), 'Mathematics-1', 'GEN-1104', 'mathematics-1', 'Algebra, trigonometry and calculus basics.', 11)
),
inserted AS (
  INSERT INTO public.lms_subjects (id, name, code, slug, description, sort_order, is_active)
  SELECT id, name, code, slug, description, sort_order, true FROM new_subjects
  RETURNING id, slug
),
dept_map AS (
  SELECT slug, id FROM public.lms_departments
),
sem_map AS (
  SELECT slug, id FROM public.lms_semesters
),
dept_links AS (
  INSERT INTO public.lms_subject_departments (subject_id, category_id)
  SELECT i.id, d.id FROM inserted i
  JOIN (VALUES
    ('programming-fundamentals','computer'),
    ('digital-electronics','computer'),
    ('digital-electronics','electronics'),
    ('structured-programming-language','computer'),
    ('engineering-drawing','civil'),
    ('engineering-drawing','mechanical'),
    ('surveying','civil'),
    ('basic-electrical-engineering','electrical'),
    ('basic-electrical-engineering','electronics'),
    ('ac-machines','electrical'),
    ('bangla','computer'),('bangla','civil'),('bangla','electrical'),('bangla','mechanical'),('bangla','electronics'),
    ('english','computer'),('english','civil'),('english','electrical'),('english','mechanical'),('english','electronics'),
    ('physics-1','computer'),('physics-1','civil'),('physics-1','electrical'),('physics-1','mechanical'),('physics-1','electronics'),
    ('mathematics-1','computer'),('mathematics-1','civil'),('mathematics-1','electrical'),('mathematics-1','mechanical'),('mathematics-1','electronics')
  ) AS m(subject_slug, dept_slug) ON i.slug = m.subject_slug
  JOIN dept_map d ON d.slug = m.dept_slug
  RETURNING 1
)
INSERT INTO public.lms_subject_semesters (subject_id, category_id)
SELECT i.id, s.id FROM inserted i
JOIN (VALUES
  ('programming-fundamentals','1'),
  ('digital-electronics','2'),
  ('structured-programming-language','2'),
  ('engineering-drawing','1'),
  ('surveying','2'),
  ('basic-electrical-engineering','1'),
  ('ac-machines','2'),
  ('bangla','1'),
  ('english','1'),
  ('physics-1','1'),
  ('mathematics-1','1')
) AS m(subject_slug, sem_slug) ON i.slug = m.subject_slug
JOIN sem_map s ON s.slug = m.sem_slug;
