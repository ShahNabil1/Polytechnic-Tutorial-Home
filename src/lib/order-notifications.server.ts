/**
 * Fire-and-forget senders for order-confirmation SMS + email.
 * Server-only — reads DB templates (respecting `enabled` toggle), renders
 * variables, sends via bulksmsbd + Resend, and logs every attempt into
 * order_sms_deliveries / order_email_deliveries.
 */
import { renderTemplate, sendBulksmsbd, estimateSmsCount, isUnicodeMessage } from "@/lib/sms.server";
import { renderEmailTemplate } from "@/lib/email-templates.server";
import { sendEbookEmail } from "@/lib/ebook-delivery.server";
import { receiptUrl } from "@/lib/site-url";

type OrderNotifyInput = {
  orderId: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  totalBdt: number;
};

export async function sendOrderConfirmationSms(
  admin: any,
  input: OrderNotifyInput,
): Promise<void> {
  try {
    if (!input.customerPhone) return;
    const { data: tpl } = await admin
      .from("sms_templates")
      .select("body, enabled")
      .eq("key", "order_confirm")
      .maybeSingle();
    if (!tpl || tpl.enabled === false || !tpl.body) return;

    const vars = {
      name: input.customerName || "গ্রাহক",
      order_no: input.orderNo,
      amount: String(input.totalBdt ?? ""),
      receipt_url: receiptUrl(input.orderNo),
      phone: input.customerPhone,
    };
    const message = renderTemplate(tpl.body as string, vars).trim();
    if (!message) return;
    const isUnicode = isUnicodeMessage(message);
    const smsCount = estimateSmsCount(message);
    const res = await sendBulksmsbd({ to: input.customerPhone, message });
    await admin.from("order_sms_deliveries").insert({
      order_id: input.orderId,
      kind: "order_confirm",
      sender_user_id: null,
      to_phone: input.customerPhone,
      body: message,
      status: res.ok ? "sent" : "failed",
      sms_count: smsCount,
      is_unicode: isUnicode,
      provider_status: res.response_code,
      provider_response: res.response?.slice(0, 500) ?? null,
      error_reason: res.ok ? null : res.code_label ?? res.response?.slice(0, 500) ?? null,
    });
    if (!res.ok) {
      console.error(
        `[order-confirm-sms] failed order=${input.orderNo} status=${res.status} resp=${res.response.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.error("[order-confirm-sms] error", input.orderNo, err);
  }
}

export async function sendOrderConfirmationEmail(
  admin: any,
  input: OrderNotifyInput,
): Promise<void> {
  try {
    if (!input.customerEmail) return;
    const { data: tpl } = await admin
      .from("email_templates")
      .select("subject, body_html, enabled")
      .eq("key", "order_confirmation")
      .maybeSingle();
    if (!tpl || tpl.enabled === false || !tpl.subject || !tpl.body_html) return;

    const vars = {
      order_no: input.orderNo,
      customer_name: input.customerName || "কাস্টমার",
      amount: String(input.totalBdt ?? ""),
      receipt_url: receiptUrl(input.orderNo),
      phone: input.customerPhone,
    };
    const subject = renderEmailTemplate(tpl.subject as string, vars);
    const body = renderEmailTemplate(tpl.body_html as string, vars);
    const html = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${body}</body></html>`;
    const res = await sendEbookEmail({ to: input.customerEmail, subject, html });
    await admin.from("order_email_deliveries").insert({
      order_id: input.orderId,
      kind: "order_confirm",
      attempt_no: 1,
      to_email: input.customerEmail,
      subject,
      status: res.ok ? "sent" : "failed",
      resend_email_id: (res as any).id ?? null,
      error_reason: res.ok ? null : (res as any).error?.slice?.(0, 500) ?? null,
      sent_at: res.ok ? new Date().toISOString() : null,
    });
    if (!res.ok) {
      console.error(
        `[order-confirm-email] failed order=${input.orderNo} status=${res.status} err=${res.error}`,
      );
    }
  } catch (err) {
    console.error("[order-confirm-email] error", input.orderNo, err);
  }
}
