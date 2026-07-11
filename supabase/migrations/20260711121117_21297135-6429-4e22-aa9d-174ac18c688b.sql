
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional';
ALTER TABLE public.sms_templates ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional';

UPDATE public.email_templates SET category = 'transactional' WHERE key IN ('order_confirmation','ebook_delivery') AND category IS DISTINCT FROM 'transactional';
UPDATE public.sms_templates SET category = 'transactional' WHERE key = 'order_confirm' AND category IS DISTINCT FROM 'transactional';
UPDATE public.sms_templates SET category = 'otp' WHERE key IN ('signup_otp','reset_otp') AND category IS DISTINCT FROM 'otp';

CREATE INDEX IF NOT EXISTS email_templates_category_idx ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS sms_templates_category_idx ON public.sms_templates(category);
