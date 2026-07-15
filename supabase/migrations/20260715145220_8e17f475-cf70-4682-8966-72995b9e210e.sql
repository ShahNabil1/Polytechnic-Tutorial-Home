
CREATE TABLE public.internal_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'internal_welcome',
  to_email text NOT NULL,
  subject text,
  resend_email_id text,
  status public.email_delivery_status NOT NULL DEFAULT 'queued',
  error_reason text,
  bounce_type text,
  provider_payload jsonb,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX internal_email_deliveries_user_idx ON public.internal_email_deliveries(user_id, created_at DESC);
CREATE INDEX internal_email_deliveries_resend_idx ON public.internal_email_deliveries(resend_email_id);

GRANT SELECT ON public.internal_email_deliveries TO authenticated;
GRANT ALL ON public.internal_email_deliveries TO service_role;

ALTER TABLE public.internal_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read internal email deliveries"
  ON public.internal_email_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_ied_updated_at
  BEFORE UPDATE ON public.internal_email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_email_deliveries;
ALTER TABLE public.internal_email_deliveries REPLICA IDENTITY FULL;

INSERT INTO public.email_templates (key, name, subject, body_html, variables, is_system, enabled, category)
VALUES (
  'internal_welcome',
  'Internal Welcome Email',
  'Welcome to Polytechnic Tutorial, {{full_name}}!',
  $HTML$
<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
  <div style="padding:32px 28px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Polytechnic Tutorial</div>
    <div style="font-size:24px;font-weight:800;margin-top:6px;line-height:1.25;">Welcome aboard, {{full_name}} 👋</div>
    <div style="font-size:14px;opacity:.9;margin-top:6px;">Your account is ready.</div>
  </div>
  <div style="padding:26px 28px 8px;font-size:15px;color:#0f172a;line-height:1.6;">
    <p style="margin:0 0 12px;">Hi {{full_name}},</p>
    <p style="margin:0 0 12px;">Your workspace account has been created. Below are your login credentials — please keep them safe and change the password after your first login.</p>
  </div>
  <div style="padding:0 28px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-size:14px;">
      <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:700;color:#475569;width:130px;">Full name</td><td style="padding:12px 16px;color:#0f172a;">{{full_name}}</td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:700;color:#475569;border-top:1px solid #e5e7eb;">Email</td><td style="padding:12px 16px;color:#0f172a;border-top:1px solid #e5e7eb;">{{email}}</td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:700;color:#475569;border-top:1px solid #e5e7eb;">Login phone</td><td style="padding:12px 16px;color:#0f172a;border-top:1px solid #e5e7eb;">{{phone}}</td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:700;color:#475569;border-top:1px solid #e5e7eb;">Password</td><td style="padding:12px 16px;color:#0f172a;border-top:1px solid #e5e7eb;font-family:ui-monospace,SFMono-Regular,monospace;font-weight:700;">{{password}}</td></tr>
      <tr><td style="padding:12px 16px;background:#f8fafc;font-weight:700;color:#475569;border-top:1px solid #e5e7eb;">Role</td><td style="padding:12px 16px;color:#0f172a;border-top:1px solid #e5e7eb;text-transform:capitalize;">{{role}}</td></tr>
    </table>
  </div>
  <div style="padding:24px 28px 8px;text-align:center;">
    <a href="{{login_url}}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;border-radius:10px;font-weight:800;text-decoration:none;font-size:15px;box-shadow:0 4px 14px rgba(79,70,229,0.35);">🚀 Login to your workspace</a>
    <div style="margin-top:10px;font-size:12px;color:#64748b;">Or paste this link into your browser:<br/><span style="font-family:ui-monospace,SFMono-Regular,monospace;color:#334155;">{{login_url}}</span></div>
  </div>
  <div style="padding:20px 28px 8px;font-size:14px;color:#334155;line-height:1.65;">
    <p style="margin:0 0 8px;font-weight:700;color:#0f172a;">How to sign in</p>
    <ol style="margin:0 0 0 18px;padding:0;color:#475569;">
      <li>Click the button above (or open the link).</li>
      <li>Sign in with your <strong>Email</strong> or <strong>Phone</strong> and the password shown above.</li>
      <li>Set up 2FA when prompted — it's required for staff accounts.</li>
      <li>Change your password from Profile → Security.</li>
    </ol>
  </div>
  <div style="padding:16px 28px 28px;font-size:12px;color:#94a3b8;line-height:1.6;border-top:1px solid #eef2f7;margin-top:20px;">
    If you didn't expect this email, please ignore it or contact your administrator. — Polytechnic Tutorial Team
  </div>
</div>
  $HTML$,
  '["full_name","email","phone","password","role","login_url"]'::jsonb,
  true,
  true,
  'transactional'
)
ON CONFLICT (key) DO NOTHING;
