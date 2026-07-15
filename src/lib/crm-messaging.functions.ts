/**
 * CRM messaging — send/resend SMS + email to any CRM contact
 * (signed-up user, guest phone, or incomplete lead), with full
 * tracking chip data via crm_sms_deliveries / crm_email_deliveries.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(context: { supabase: any; userId: string }) {
  const { data: canManage } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_users",
  });
  if (!canManage) throw new Error("Forbidden");
}

// ---------- Vars & rendering ----------

export type CrmVars = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  student_id?: string | null;
  last_order_no?: string | null;
  ltv?: string | number | null;
};

function renderVars(body: string, vars: CrmVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    const v = (vars as Record<string, unknown>)[k];
    return v == null ? "" : String(v);
  });
}

// ---------- SMS ----------

export const sendCrmSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid().nullable().optional(),
        to_phone: z.string().min(6).max(30),
        body: z.string().min(1).max(1000),
        template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendBulksmsbd, estimateSmsCount, isUnicodeMessage } = await import(
      "@/lib/sms.server"
    );
    const message = data.body.trim();
    if (!message) throw new Error("Empty message");
    const isUnicode = isUnicodeMessage(message);
    const smsCount = estimateSmsCount(message);
    const res = await sendBulksmsbd({ to: data.to_phone, message });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("crm_sms_deliveries").insert({
      user_id: data.user_id ?? null,
      to_phone: data.to_phone,
      body: message,
      template_id: data.template_id ?? null,
      kind: "crm_manual",
      sender_user_id: context.userId,
      status: res.ok ? "sent" : "failed",
      sms_count: smsCount,
      is_unicode: isUnicode,
      provider_status: res.response_code,
      provider_response: res.response?.slice(0, 500) ?? null,
      error_reason: res.ok ? null : res.code_label ?? res.response?.slice(0, 500) ?? null,
    } as never);

    if (!res.ok) throw new Error(`SMS failed: ${res.code_label} (#${res.response_code ?? "?"})`);
    return { ok: true, smsCount };
  });

// ---------- Email ----------

export const sendCrmEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid().nullable().optional(),
        to_email: z.string().email().max(255),
        subject: z.string().min(1).max(300),
        body_html: z.string().min(1).max(50000),
        template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");
    const wrapped = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${data.body_html}</body></html>`;
    const res = await sendEbookEmail({
      to: data.to_email,
      subject: data.subject,
      html: wrapped,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("crm_email_deliveries")
      .insert({
        user_id: data.user_id ?? null,
        to_email: data.to_email,
        subject: data.subject,
        body_html: data.body_html,
        template_id: data.template_id ?? null,
        kind: "crm_manual",
        attempt_no: 1,
        sender_user_id: context.userId,
        resend_email_id: res.ok ? res.id : null,
        status: res.ok ? "sent" : "failed",
        sent_at: res.ok ? nowIso : null,
        error_reason: res.ok ? null : (res as any).error?.slice?.(0, 500) ?? null,
      } as never)
      .select("id")
      .single();
    if (error) console.error("[sendCrmEmail] log error", error);

    if (!res.ok) throw new Error(`Email send failed: ${(res as any).error}`);
    return { ok: true, id: (inserted as any)?.id as string | undefined };
  });

// Resend an existing email delivery (same body/subject/recipient)
export const resendCrmEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ delivery_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev, error } = await supabaseAdmin
      .from("crm_email_deliveries")
      .select("*")
      .eq("id", data.delivery_id)
      .single();
    if (error) throw new Error(error.message);
    if (!prev) throw new Error("Delivery not found");

    const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");
    const p: any = prev;
    const wrapped = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${p.body_html}</body></html>`;
    const res = await sendEbookEmail({
      to: p.to_email,
      subject: p.subject,
      html: wrapped,
    });

    // Find highest attempt_no for this chain
    const rootId = p.parent_delivery_id ?? p.id;
    const { data: attempts } = await supabaseAdmin
      .from("crm_email_deliveries")
      .select("attempt_no")
      .or(`id.eq.${rootId},parent_delivery_id.eq.${rootId}`)
      .order("attempt_no", { ascending: false })
      .limit(1);
    const nextAttempt = ((attempts?.[0] as any)?.attempt_no ?? p.attempt_no ?? 1) + 1;

    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("crm_email_deliveries").insert({
      user_id: p.user_id,
      to_email: p.to_email,
      subject: p.subject,
      body_html: p.body_html,
      template_id: p.template_id,
      kind: "crm_resend",
      attempt_no: nextAttempt,
      parent_delivery_id: rootId,
      sender_user_id: context.userId,
      resend_email_id: res.ok ? res.id : null,
      status: res.ok ? "sent" : "failed",
      sent_at: res.ok ? nowIso : null,
      error_reason: res.ok ? null : (res as any).error?.slice?.(0, 500) ?? null,
    } as never);

    if (!res.ok) throw new Error(`Email resend failed: ${(res as any).error}`);
    return { ok: true };
  });

// ---------- History ----------

export type CrmSmsDelivery = {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  sms_count: number | null;
  is_unicode: boolean | null;
  provider_status: number | null;
  error_reason: string | null;
  created_at: string;
};

export type CrmEmailDelivery = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  attempt_no: number;
  parent_delivery_id: string | null;
  error_reason: string | null;
  bounce_type: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
};

export const listCrmDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid().nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        email: z.string().max(255).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let smsQ = supabaseAdmin
      .from("crm_sms_deliveries")
      .select(
        "id,to_phone,body,status,sms_count,is_unicode,provider_status,error_reason,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    let emailQ = supabaseAdmin
      .from("crm_email_deliveries")
      .select(
        "id,to_email,subject,status,attempt_no,parent_delivery_id,error_reason,bounce_type,sent_at,delivered_at,opened_at,clicked_at,bounced_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.user_id) {
      smsQ = smsQ.eq("user_id", data.user_id);
      emailQ = emailQ.eq("user_id", data.user_id);
    } else {
      const orParts: string[] = [];
      if (data.phone) orParts.push(`to_phone.eq.${data.phone}`);
      if (orParts.length > 0) smsQ = smsQ.or(orParts.join(","));
      const emOrParts: string[] = [];
      if (data.email) emOrParts.push(`to_email.eq.${data.email}`);
      if (emOrParts.length > 0) emailQ = emailQ.or(emOrParts.join(","));
      if (orParts.length === 0) smsQ = smsQ.limit(0);
      if (emOrParts.length === 0) emailQ = emailQ.limit(0);
    }

    const [{ data: sms }, { data: emails }] = await Promise.all([smsQ, emailQ]);
    return {
      sms: (sms ?? []) as CrmSmsDelivery[],
      emails: (emails ?? []) as CrmEmailDelivery[],
    };
  });

// Expose for the composer preview button (client-side prefill).
export const previewTemplate = (body: string, vars: CrmVars) => renderVars(body, vars);
