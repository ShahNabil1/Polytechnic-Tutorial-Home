INSERT INTO public.sms_templates (key, name, body, variables, category, is_system, enabled)
VALUES (
  'internal_password_reset',
  'Password Reset (Internal)',
  'নমস্কার {{name}}, আপনার পাসওয়ার্ড রিসেট করা হয়েছে। নতুন পাসওয়ার্ড: {{password}} । লগইন: {{login_url}}',
  '["name","password","login_url","phone"]'::jsonb,
  'transactional',
  true,
  true
)
ON CONFLICT (key) DO NOTHING;