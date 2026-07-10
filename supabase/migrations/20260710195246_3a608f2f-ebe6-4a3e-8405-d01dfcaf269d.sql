
-- 1) Roles enum
CREATE TYPE public.app_role AS ENUM ('student', 'employee', 'instructor', 'super_admin');

-- 2) user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
-- exactly one super_admin
CREATE UNIQUE INDEX user_roles_one_super_admin ON public.user_roles ((role)) WHERE role = 'super_admin';
CREATE INDEX user_roles_user_id_idx ON public.user_roles(user_id);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) has_role security definer (no recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 4) get_primary_role: super_admin > instructor > employee > student
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'instructor' THEN 2
    WHEN 'employee' THEN 3
    WHEN 'student' THEN 4
  END
  LIMIT 1;
$$;

-- 5) Policies for user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin views all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin inserts roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin updates roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin deletes roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- 6) user_permissions (granular for employees; free-form permission keys)
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
CREATE INDEX user_permissions_user_id_idx ON public.user_permissions(user_id);

GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin views all permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin manages permissions" ON public.user_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _permission);
$$;

-- 7) internal_profiles for non-student staff
CREATE TABLE public.internal_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id text NOT NULL UNIQUE,
  address text,
  nid_number text,
  cv_r2_key text,
  bank_details jsonb,
  workplace text,
  job_role text,
  subjects text[] NOT NULL DEFAULT '{}',
  departments text[] NOT NULL DEFAULT '{}',
  mfa_enrolled boolean NOT NULL DEFAULT false,
  first_login_completed boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.internal_profiles TO authenticated;
GRANT ALL ON public.internal_profiles TO service_role;
ALTER TABLE public.internal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own internal profile" ON public.internal_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin views all internal profiles" ON public.internal_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users update own internal profile" ON public.internal_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin updates all internal profiles" ON public.internal_profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin inserts internal profiles" ON public.internal_profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_internal_profiles_updated
  BEFORE UPDATE ON public.internal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Display ID generator + trigger on user_roles insert
CREATE OR REPLACE FUNCTION public.generate_internal_display_id(_role public.app_role)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  candidate text;
  digits int;
  max_tries int := 50;
  i int := 0;
BEGIN
  IF _role = 'super_admin' THEN
    RETURN '001';
  ELSIF _role = 'employee' THEN
    digits := 4;
  ELSIF _role = 'instructor' THEN
    digits := 5;
  ELSE
    RETURN NULL;
  END IF;

  LOOP
    i := i + 1;
    candidate := lpad(((floor(random() * (power(10, digits) - power(10, digits-1))) + power(10, digits-1))::int)::text, digits, '0');
    IF NOT EXISTS (SELECT 1 FROM public.internal_profiles WHERE display_id = candidate) THEN
      RETURN candidate;
    END IF;
    IF i >= max_tries THEN
      RAISE EXCEPTION 'Could not generate unique display_id for role %', _role;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_internal_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('employee', 'instructor', 'super_admin') THEN
    INSERT INTO public.internal_profiles (user_id, display_id)
    VALUES (NEW.user_id, public.generate_internal_display_id(NEW.role))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_roles_internal_profile
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_internal_role();

-- 9) Update handle_new_user to also assign 'student'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 10) Backfill existing users as students
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 11) Seed first Super Admin (phone 8801338125069)
INSERT INTO public.user_roles (user_id, role, assigned_at)
VALUES ('5e817c23-8949-4c2f-8fb2-f79d574dd090', 'super_admin', now())
ON CONFLICT (user_id, role) DO NOTHING;
-- ensure display_id 001 exists (trigger creates row; force to 001 in case of collision-avoid path)
UPDATE public.internal_profiles SET display_id = '001', first_login_completed = true
WHERE user_id = '5e817c23-8949-4c2f-8fb2-f79d574dd090';
