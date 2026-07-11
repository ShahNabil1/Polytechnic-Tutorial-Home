ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;