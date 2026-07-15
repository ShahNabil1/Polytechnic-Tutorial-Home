/**
 * Phase 3 CRM — bulk SMS + email, saved segments, per-customer coupons.
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

// ---------- Vars ----------

export type BulkVars = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  last_order_no?: string | null;
  ltv?: string | number | null;
  coupon_code?: string | null;
};

function renderVars(body: string, vars: BulkVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    const v = (vars as Record<string, unknown>)[k];
    return v == null ? "" : String(v);
  });
}

// ---------- Bulk SMS ----------

const BulkSmsRecipient = z.object({
  user_id: z.string().uuid().nullable().optional(),
  phone: z.string().min(6).max(30),
  vars: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      last_order_no: z.string().nullable().optional(),
      ltv: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .optional(),
});

export const sendCrmBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipients: z.array(BulkSmsRecipient).min(1).max(500),
        body: z.string().min(1).max(1000),
        template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendBulksmsbdMany, estimateSmsCount, isUnicodeMessage } = await import(
      "@/lib/sms.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Pre-render every message; skip empties up front
    type Prep = {
      user_id: string | null;
      to_phone: string;
      body: string;
      is_unicode: boolean;
      sms_count: number;
    };
    const prepared: Prep[] = [];
    let skipped = 0;
    for (const r of data.recipients) {
      const rendered = renderVars(data.body, {
        name: r.vars?.name ?? null,
        phone: r.phone,
        email: r.vars?.email ?? null,
        last_order_no: r.vars?.last_order_no ?? null,
        ltv: r.vars?.ltv ?? null,
      }).trim();
      if (!rendered) {
        skipped++;
        continue;
      }
      prepared.push({
        user_id: r.user_id ?? null,
        to_phone: r.phone,
        body: rendered,
        is_unicode: isUnicodeMessage(rendered),
        sms_count: estimateSmsCount(rendered),
      });
    }

    // 2. Chunk into batches for bulksmsbd many-to-many API. Provider caps
    //    a single POST around ~100 rows; keep well below that. A short
    //    delay between batches spreads load on the SMS gateway.
    const CHUNK = 80;
    const DELAY_MS = 250;
    let sent = 0;
    let failed = skipped;
    const rows: any[] = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < prepared.length; i += CHUNK) {
      const chunk = prepared.slice(i, i + CHUNK);
      let batch: {
        ok: boolean;
        status: number;
        response_code: number | null;
        code_label: string;
        response: string;
        perMessage: Array<{ ok: boolean; response_code: number | null; code_label: string }>;
      };
      try {
        batch = await sendBulksmsbdMany({
          messages: chunk.map((p) => ({ to: p.to_phone, message: p.body })),
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        batch = {
          ok: false,
          status: 0,
          response_code: null,
          code_label: msg.slice(0, 120),
          response: msg,
          perMessage: chunk.map(() => ({
            ok: false,
            response_code: null,
            code_label: msg.slice(0, 120),
          })),
        };
      }
      for (let j = 0; j < chunk.length; j++) {
        const p = chunk[j];
        const per = batch.perMessage[j];
        if (per.ok) sent++;
        else failed++;
        rows.push({
          user_id: p.user_id,
          to_phone: p.to_phone,
          body: p.body,
          template_id: data.template_id ?? null,
          kind: "crm_bulk",
          sender_user_id: context.userId,
          status: per.ok ? "sent" : "failed",
          sms_count: p.sms_count,
          is_unicode: p.is_unicode,
          provider_status: per.response_code,
          provider_response: batch.response?.slice(0, 500) ?? null,
          error_reason: per.ok ? null : per.code_label ?? batch.response?.slice(0, 500) ?? null,
          created_at: nowIso,
        });
      }
      if (i + CHUNK < prepared.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    // 3. Persist delivery logs in chunks (Supabase insert limit is generous
    //    but we stay under 500 per statement to be safe).
    const LOG_CHUNK = 500;
    for (let i = 0; i < rows.length; i += LOG_CHUNK) {
      const slice = rows.slice(i, i + LOG_CHUNK);
      const { error } = await supabaseAdmin
        .from("crm_sms_deliveries")
        .insert(slice as never);
      if (error) console.error("[sendCrmBulkSms] log error", error);
    }
    return { sent, failed, total: data.recipients.length };
  });

// ---------- Bulk Email ----------

const BulkEmailRecipient = z.object({
  user_id: z.string().uuid().nullable().optional(),
  email: z.string().email().max(255),
  vars: z
    .object({
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      last_order_no: z.string().nullable().optional(),
      ltv: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .optional(),
});

export const sendCrmBulkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipients: z.array(BulkEmailRecipient).min(1).max(500),
        subject: z.string().min(1).max(300),
        body_html: z.string().min(1).max(50000),
        template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-render everything, then send with limited concurrency so we
    // don't hammer Resend or the provider rate limits. Chunks are queued;
    // within a chunk sends run in parallel.
    const prepared = data.recipients.map((r) => {
      const rVars: BulkVars = {
        name: r.vars?.name ?? null,
        phone: r.vars?.phone ?? null,
        email: r.email,
        last_order_no: r.vars?.last_order_no ?? null,
        ltv: r.vars?.ltv ?? null,
      };
      const subject = renderVars(data.subject, rVars).trim();
      const body = renderVars(data.body_html, rVars);
      return { user_id: r.user_id ?? null, to_email: r.email, subject, body };
    });

    const CHUNK = 10; // parallel sends per wave
    const DELAY_MS = 300;
    let sent = 0;
    let failed = 0;
    const rows: any[] = [];

    for (let i = 0; i < prepared.length; i += CHUNK) {
      const chunk = prepared.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async (p) => {
          const wrapped = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${p.body}</body></html>`;
          try {
            const res: any = await sendEbookEmail({
              to: p.to_email,
              subject: p.subject,
              html: wrapped,
            });
            return { p, res };
          } catch (e: any) {
            return { p, res: { ok: false, error: String(e?.message ?? e) } };
          }
        }),
      );
      const nowIso = new Date().toISOString();
      for (const { p, res } of results) {
        if (res.ok) sent++;
        else failed++;
        rows.push({
          user_id: p.user_id,
          to_email: p.to_email,
          subject: p.subject,
          body_html: p.body,
          template_id: data.template_id ?? null,
          kind: "crm_bulk",
          attempt_no: 1,
          sender_user_id: context.userId,
          resend_email_id: res.ok ? res.id : null,
          status: res.ok ? "sent" : "failed",
          sent_at: res.ok ? nowIso : null,
          error_reason: res.ok ? null : res.error?.slice?.(0, 500) ?? null,
        });
      }
      if (i + CHUNK < prepared.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    const LOG_CHUNK = 500;
    for (let i = 0; i < rows.length; i += LOG_CHUNK) {
      const slice = rows.slice(i, i + LOG_CHUNK);
      const { error } = await supabaseAdmin
        .from("crm_email_deliveries")
        .insert(slice as never);
      if (error) console.error("[sendCrmBulkEmail] log error", error);
    }
    return { sent, failed, total: data.recipients.length };
  });


// ---------- Segments ----------

export type CrmSegmentRow = {
  id: string;
  name: string;
  description: string | null;
  kind: "customers" | "signed" | "guests" | "incomplete";
  filter: { search?: string };
  created_at: string;
};

export const listCrmSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ kind: z.enum(["customers", "signed", "guests", "incomplete"]).optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("crm_segments")
      .select("id, name, description, kind, filter, created_at")
      .order("created_at", { ascending: false });
    if (data?.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmSegmentRow[];
  });

export const saveCrmSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional().nullable(),
        kind: z.enum(["customers", "signed", "guests", "incomplete"]),
        filter: z.object({ search: z.string().optional() }).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("crm_segments")
        .update({
          name: data.name,
          description: data.description ?? null,
          kind: data.kind,
          filter: data.filter,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("crm_segments")
      .insert({
        name: data.name,
        description: data.description ?? null,
        kind: data.kind,
        filter: data.filter,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string };
  });

export const deleteCrmSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_segments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Per-customer coupon ----------

export const createCrmCustomerCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        code: z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, - and _"),
        name: z.string().trim().min(1).max(120),
        discount_type: z.enum(["percent", "flat"]),
        discount_value: z.number().positive(),
        cap_amount: z.number().positive().nullable().optional(),
        min_spend: z.number().nonnegative().default(0),
        max_uses_per_customer: z.number().int().positive().nullable().optional(),
        ends_at: z.string().nullable().optional(),
        scope: z.enum(["shop", "course", "special"]).default("shop"),
        notify_sms: z.boolean().default(false),
        notify_email: z.boolean().default(false),
        notify_phone: z.string().nullable().optional(),
        notify_email_addr: z.string().email().nullable().optional(),
        notify_name: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert coupon (customer-scoped)
    const { data: coupon, error: cErr } = await supabaseAdmin
      .from("coupons")
      .insert({
        scope: data.scope,
        code: data.code,
        name: data.name,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        cap_amount: data.cap_amount ?? null,
        min_spend: data.min_spend ?? 0,
        max_uses_total: data.max_uses_per_customer ?? 1,
        max_uses_per_customer: data.max_uses_per_customer ?? 1,
        applies_to: "customers",
        ends_at: data.ends_at || null,
        is_active: true,
        stackable: false,
        exclude_shipping: true,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const couponId = (coupon as any).id as string;

    const { error: tErr } = await supabaseAdmin.from("coupon_targets").insert({
      coupon_id: couponId,
      target_type: "customer",
      target_id: data.user_id,
    } as never);
    if (tErr) throw new Error(tErr.message);

    // Notify
    const vars: BulkVars = {
      name: data.notify_name ?? null,
      phone: data.notify_phone ?? null,
      email: data.notify_email_addr ?? null,
      coupon_code: data.code,
    };
    const notifyMsg = `Hi ${vars.name || "there"}, here's your exclusive coupon: ${data.code} — ${
      data.discount_type === "percent"
        ? `${data.discount_value}% off`
        : `৳${data.discount_value} off`
    }${data.min_spend ? ` (min spend ৳${data.min_spend})` : ""}. Use at checkout.`;

    let smsResult: { ok: boolean; error?: string } | null = null;
    if (data.notify_sms && data.notify_phone) {
      try {
        const { sendBulksmsbd, estimateSmsCount, isUnicodeMessage } = await import(
          "@/lib/sms.server"
        );
        const res = await sendBulksmsbd({ to: data.notify_phone, message: notifyMsg });
        await supabaseAdmin.from("crm_sms_deliveries").insert({
          user_id: data.user_id,
          to_phone: data.notify_phone,
          body: notifyMsg,
          kind: "crm_coupon",
          sender_user_id: context.userId,
          status: res.ok ? "sent" : "failed",
          sms_count: estimateSmsCount(notifyMsg),
          is_unicode: isUnicodeMessage(notifyMsg),
          provider_status: res.status,
          provider_response: res.response?.slice(0, 500) ?? null,
          error_reason: res.ok ? null : res.response?.slice(0, 500) ?? null,
        } as never);
        smsResult = { ok: res.ok, error: res.ok ? undefined : res.response ?? undefined };
      } catch (e: any) {
        smsResult = { ok: false, error: String(e?.message ?? e) };
      }
    }

    let emailResult: { ok: boolean; error?: string } | null = null;
    if (data.notify_email && data.notify_email_addr) {
      try {
        const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");
        const subject = `Your exclusive coupon: ${data.code}`;
        const body = `<p>Hi ${vars.name || "there"},</p><p>Here's an exclusive coupon just for you:</p><p style="font-size:20px;font-weight:bold;letter-spacing:1px;padding:12px 20px;background:#f1f5f9;border-radius:8px;display:inline-block;">${data.code}</p><p>${
          data.discount_type === "percent"
            ? `Get <strong>${data.discount_value}% off</strong>`
            : `Get <strong>৳${data.discount_value} off</strong>`
        }${data.min_spend ? ` on orders above ৳${data.min_spend}` : ""}.</p><p>Use it at checkout.</p>`;
        const wrapped = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${body}</body></html>`;
        const res: any = await sendEbookEmail({
          to: data.notify_email_addr,
          subject,
          html: wrapped,
        });
        await supabaseAdmin.from("crm_email_deliveries").insert({
          user_id: data.user_id,
          to_email: data.notify_email_addr,
          subject,
          body_html: body,
          kind: "crm_coupon",
          attempt_no: 1,
          sender_user_id: context.userId,
          resend_email_id: res.ok ? res.id : null,
          status: res.ok ? "sent" : "failed",
          sent_at: res.ok ? new Date().toISOString() : null,
          error_reason: res.ok ? null : res.error?.slice?.(0, 500) ?? null,
        } as never);
        emailResult = { ok: res.ok, error: res.ok ? undefined : res.error };
      } catch (e: any) {
        emailResult = { ok: false, error: String(e?.message ?? e) };
      }
    }

    return { coupon_id: couponId, code: data.code, smsResult, emailResult };
  });

// List customer's coupons (customer-scoped targets)
export const listCrmCustomerCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targets, error } = await supabaseAdmin
      .from("coupon_targets")
      .select("coupon_id, coupons(id, code, name, discount_type, discount_value, min_spend, ends_at, is_active, uses_count, max_uses_per_customer, created_at, deleted_at)")
      .eq("target_type", "customer")
      .eq("target_id", data.user_id);
    if (error) throw new Error(error.message);
    return (targets ?? [])
      .map((t: any) => t.coupons)
      .filter((c: any) => c && !c.deleted_at)
      .map((c: any) => ({
        ...c,
        discount_value: Number(c.discount_value),
        min_spend: Number(c.min_spend),
      })) as Array<{
      id: string;
      code: string;
      name: string;
      discount_type: "percent" | "flat";
      discount_value: number;
      min_spend: number;
      ends_at: string | null;
      is_active: boolean;
      uses_count: number;
      max_uses_per_customer: number | null;
      created_at: string;
    }>;
  });
