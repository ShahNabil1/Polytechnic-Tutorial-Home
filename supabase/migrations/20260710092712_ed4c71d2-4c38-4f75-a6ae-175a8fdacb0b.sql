CREATE OR REPLACE FUNCTION public.protect_student_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    NEW.student_id := OLD.student_id;
  END IF;
  RETURN NEW;
END;
$$;