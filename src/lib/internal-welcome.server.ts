/**
 * Server-only helper: send the welcome email to a newly created employee /
 * instructor and log the Resend delivery in `internal_email_deliveries`
 * (mirrors `order_email_deliveries` so realtime status chips work the same).
 */
import { renderEmailTemplate } from "@/lib/email-templates.server";
import { sendEbookEmail } from "@/lib/ebook-delivery.server";
import { SITE_URL } from "@/lib/site-url";

type WelcomeInput = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: "employee" | "instructor";
};

export async function sendInternalWelcomeEmail(
  admin: any,
  input: WelcomeInput,
): Promise<void> {
  try {
    if (!input.email) return;

    const { data: tpl } = await admin
      .from("email_templates")
      .select("subject, body_html, enabled")
      .eq("key", "internal_welcome")
      .maybeSingle();

    if (!tpl || tpl.enabled === false || !tpl.subject || !tpl.body_html) return;

    const loginUrl = `${SITE_URL}/auth`;
    const vars = {
      full_name: input.fullName || "Team member",
      email: input.email,
      phone: input.phone,
      password: input.password,
      role: input.role,
      login_url: loginUrl,
    };

    const subject = renderEmailTemplate(tpl.subject as string, vars);
    const body = renderEmailTemplate(tpl.body_html as string, vars);
    const html = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${body}</body></html>`;

    // Insert a queued row first so the Logs panel shows the attempt immediately.
    const { data: row } = await admin
      .from("internal_email_deliveries")
      .insert({
        user_id: input.userId,
        kind: "internal_welcome",
        to_email: input.email,
        subject,
        status: "queued",
      })
      .select("id")
      .single();

    const res = await sendEbookEmail({ to: input.email, subject, html });

    if (row?.id) {
      await admin
        .from("internal_email_deliveries")
        .update({
          status: res.ok ? "sent" : "failed",
          resend_email_id: res.ok ? (res as any).id : null,
          sent_at: res.ok ? new Date().toISOString() : null,
          error_reason: res.ok ? null : (res as any).error?.slice?.(0, 500) ?? null,
        })
        .eq("id", row.id);
    }

    if (!res.ok) {
      console.error(
        `[internal-welcome-email] failed user=${input.userId} status=${(res as any).status} err=${(res as any).error}`,
      );
    }
  } catch (err) {
    console.error("[internal-welcome-email] error", input.userId, err);
  }
}
