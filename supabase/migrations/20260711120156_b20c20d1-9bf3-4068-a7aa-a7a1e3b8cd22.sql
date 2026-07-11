CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view email templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Staff can insert email templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Staff can update email templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Staff can delete non-system email templates"
  ON public.email_templates FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'super_admin'))
    AND is_system = false
  );

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_templates (key, name, subject, body_html, variables, is_system) VALUES
(
  'ebook_delivery',
  'E-book Delivery',
  'আপনার ই-বুক প্রস্তুত — Order {{order_no}}',
  '<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
  <div style="padding:28px 24px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Polytechnic Tutorial</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px;">আপনার ই-বুক প্রস্তুত!</div>
    <div style="font-size:13px;opacity:.9;margin-top:4px;">Order #{{order_no}}</div>
  </div>
  <div style="padding:22px 24px;font-size:15px;color:#0f172a;line-height:1.55;">
    <p>প্রিয় {{customer_name}},</p>
    <p>আপনার অর্ডারের ই-বুক সমূহের ডাউনলোড লিংক নিচে দেয়া হলো।</p>
    {{ebook_list}}
    <p style="margin-top:16px;font-size:12px;color:#64748b;">কোনো সমস্যায় support এ যোগাযোগ করুন। ধন্যবাদ! 🙏</p>
  </div>
</div>',
  '["order_no","customer_name","ebook_list"]'::jsonb,
  true
),
(
  'order_confirmation',
  'Order Confirmation',
  'অর্ডার নিশ্চিত হয়েছে — {{order_no}}',
  '<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
  <div style="padding:28px 24px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Polytechnic Tutorial</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px;">অর্ডার নিশ্চিত হয়েছে ✅</div>
    <div style="font-size:13px;opacity:.9;margin-top:4px;">Order #{{order_no}}</div>
  </div>
  <div style="padding:22px 24px;font-size:15px;color:#0f172a;line-height:1.55;">
    <p>প্রিয় {{customer_name}},</p>
    <p>আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে।</p>
    <p><b>মোট এমাউন্ট:</b> ৳{{amount}}</p>
    <p><a href="{{receipt_url}}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;">রিসিপ্ট দেখুন</a></p>
    <p style="margin-top:16px;font-size:12px;color:#64748b;">ধন্যবাদ আমাদের সাথে থাকার জন্য! 🙏</p>
  </div>
</div>',
  '["order_no","customer_name","amount","receipt_url"]'::jsonb,
  true
);