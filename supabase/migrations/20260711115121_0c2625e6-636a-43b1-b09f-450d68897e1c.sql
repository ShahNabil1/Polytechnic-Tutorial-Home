
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  name text NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sms templates" ON public.sms_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can insert sms templates" ON public.sms_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can update sms templates" ON public.sms_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Staff can delete non-system sms templates" ON public.sms_templates
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'employee') OR public.has_role(auth.uid(), 'super_admin'))
    AND is_system = false
  );

CREATE TRIGGER trg_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sms_templates (key, name, body, variables, is_system) VALUES
  (
    'order_confirm',
    'Order Confirmation',
    'প্রিয় {{name}},{{newline}}আপনার অর্ডার {{order_no}} নিশ্চিত হয়েছে। মোট: {{amount}} টাকা।{{newline}}রিসিপ্ট: {{receipt_url}}{{newline}}ধন্যবাদ — Polytechnic Tutorial Home',
    '["name","order_no","amount","receipt_url","phone"]'::jsonb,
    true
  ),
  (
    'signup_otp',
    'Signup OTP Verification',
    'প্রিয় {{name}},{{newline}}আপনার Polytechnic Tutorial Home OTP কোড: {{otp}}{{newline}}কোডটি ৫ মিনিটের জন্য বৈধ। কারো সাথে শেয়ার করবেন না।',
    '["name","otp"]'::jsonb,
    true
  ),
  (
    'reset_otp',
    'Password Reset OTP',
    'প্রিয় {{name}},{{newline}}পাসওয়ার্ড রিসেট করতে আপনার OTP কোড: {{otp}}{{newline}}কোডটি ৫ মিনিটের জন্য বৈধ। কারো সাথে শেয়ার করবেন না।',
    '["name","otp"]'::jsonb,
    true
  );
