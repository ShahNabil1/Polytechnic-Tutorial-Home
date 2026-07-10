-- Semester enum
DO $$ BEGIN
  CREATE TYPE public.semester_level AS ENUM (
    '1st','2nd','3rd','4th','5th','6th','7th','8th','graduated','probation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for student_id starting at 1000 (no upper limit)
CREATE SEQUENCE IF NOT EXISTS public.student_id_seq START 1000 MINVALUE 1000 NO MAXVALUE;

-- New profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS institute_name text,
  ADD COLUMN IF NOT EXISTS department_name text,
  ADD COLUMN IF NOT EXISTS current_semester public.semester_level,
  ADD COLUMN IF NOT EXISTS board_roll text,
  ADD COLUMN IF NOT EXISTS registration_no text;

-- Backfill existing rows
UPDATE public.profiles
   SET student_id = nextval('public.student_id_seq')
 WHERE student_id IS NULL;

-- Make student_id required going forward with a safe default
ALTER TABLE public.profiles
  ALTER COLUMN student_id SET DEFAULT nextval('public.student_id_seq'),
  ALTER COLUMN student_id SET NOT NULL;

-- Ensure profiles are created for any auth user missing one, so trigger + student_id apply
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Trigger on auth.users -> creates profile (which auto-assigns student_id via default)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent client from changing student_id even though they can UPDATE their own row
CREATE OR REPLACE FUNCTION public.protect_student_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    NEW.student_id := OLD.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_student_id ON public.profiles;
CREATE TRIGGER profiles_protect_student_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_student_id();