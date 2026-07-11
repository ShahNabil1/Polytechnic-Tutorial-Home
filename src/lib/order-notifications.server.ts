/**
 * Fire-and-forget senders for order-confirmation SMS + email.
 * Server-only — reads DB templates (respecting `enabled` toggle), renders
 * variables, and sends via bulksmsbd + Resend.
 */
import { renderTemplate, sendBulksmsbd } from "@/lib/sms.server";
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
    const res = await sendBulksmsbd({ to: input.customerPhone, message });
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
    if (!res.ok) {
      console.error(
        `[order-confirm-email] failed order=${input.orderNo} status=${res.status} err=${res.error}`,
      );
    }
  } catch (err) {
    console.error("[order-confirm-email] error", input.orderNo, err);
  }
}
