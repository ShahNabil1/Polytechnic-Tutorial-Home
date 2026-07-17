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
  phone: z.string().max(30).nullable().optional(),
  vars: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      last_order_no: z.string().nullable().optional(),
      ltv: z.union([z.string(), z.number()]).nullable().optional(),
    })
    .optional(),
});

export type BulkBreakdownRow = {
  user_id: string | null;
  contact: string | null;
  name: string | null;
  status: "sent" | "failed" | "skipped";
  provider_code: number | null;
  error_reason: string | null;
};

export const sendCrmBulkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        recipients: z.array(BulkSmsRecipient).min(1).max(500),
        body: z.string().min(1).max(1000),
        template_id: z.string().uuid().nullable().optional(),
        campaign_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendBulksmsbdMany, estimateSmsCount, isUnicodeMessage } = await import(
      "@/lib/sms.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create (or reuse) the campaign row
    let campaignId = data.campaign_id ?? null;
    if (!campaignId) {
      const { data: campaign, error: cErr } = await supabaseAdmin
        .from("crm_bulk_campaigns")
        .insert({
          channel: "sms",
          body: data.body,
          template_id: data.template_id ?? null,
          sender_user_id: context.userId,
          total: data.recipients.length,
        } as never)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      campaignId = (campaign as any).id as string;
    }

    // 2. Split recipients: skipped (no phone) go straight to logs.
    type Prep = {
      user_id: string | null;
      name: string | null;
      to_phone: string;
      body: string;
      is_unicode: boolean;
      sms_count: number;
    };
    const prepared: Prep[] = [];
    const skippedRows: any[] = [];
    const breakdown: BulkBreakdownRow[] = [];
    const nowIso = new Date().toISOString();
    for (const r of data.recipients) {
      const name = r.vars?.name ?? null;
      const phone = (r.phone ?? "").trim();
      if (!phone) {
        skippedRows.push({
          user_id: r.user_id ?? null,
          to_phone: null,
          body: data.body,
          template_id: data.template_id ?? null,
          kind: "crm_bulk",
          sender_user_id: context.userId,
          status: "skipped",
          error_reason: "No phone on file",
          campaign_id: campaignId,
          created_at: nowIso,
        });
        breakdown.push({ user_id: r.user_id ?? null, contact: null, name, status: "skipped", provider_code: null, error_reason: "No phone on file" });
        continue;
      }
      const rendered = renderVars(data.body, {
        name,
        phone,
        email: r.vars?.email ?? null,
        last_order_no: r.vars?.last_order_no ?? null,
        ltv: r.vars?.ltv ?? null,
      }).trim();
      if (!rendered) {
        skippedRows.push({
          user_id: r.user_id ?? null,
          to_phone: phone,
          body: data.body,
          template_id: data.template_id ?? null,
          kind: "crm_bulk",
          sender_user_id: context.userId,
          status: "skipped",
          error_reason: "Empty message after variable substitution",
          campaign_id: campaignId,
          created_at: nowIso,
        });
        breakdown.push({ user_id: r.user_id ?? null, contact: phone, name, status: "skipped", provider_code: null, error_reason: "Empty message after variables" });
        continue;
      }
      prepared.push({
        user_id: r.user_id ?? null,
        name,
        to_phone: phone,
        body: rendered,
        is_unicode: isUnicodeMessage(rendered),
        sms_count: estimateSmsCount(rendered),
      });
    }

    // 3. Chunk into batches for bulksmsbd many-to-many API.
    const CHUNK = 80;
    const DELAY_MS = 250;
    let sent = 0;
    let failed = 0;
    const sendRows: any[] = [];

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
        sendRows.push({
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
          campaign_id: campaignId,
          attempt_no: 1,
          created_at: nowIso,
        });
        breakdown.push({
          user_id: p.user_id,
          contact: p.to_phone,
          name: p.name,
          status: per.ok ? "sent" : "failed",
          provider_code: per.response_code,
          error_reason: per.ok ? null : per.code_label,
        });
      }
      if (i + CHUNK < prepared.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    // 4. Persist all rows (skipped + send)
    const allRows = [...skippedRows, ...sendRows];
    const LOG_CHUNK = 500;
    for (let i = 0; i < allRows.length; i += LOG_CHUNK) {
      const slice = allRows.slice(i, i + LOG_CHUNK);
      const { error } = await supabaseAdmin.from("crm_sms_deliveries").insert(slice as never);
      if (error) console.error("[sendCrmBulkSms] log error", error);
    }

    // 5. Update campaign totals (accumulate for retry runs)
    const skippedCount = skippedRows.length;
    const total = data.recipients.length;
    if (data.campaign_id) {
      // retry run — accumulate onto existing campaign totals
      const { data: existing } = await supabaseAdmin
        .from("crm_bulk_campaigns")
        .select("total, sent, failed, skipped_no_contact")
        .eq("id", campaignId)
        .single();
      const ex: any = existing ?? {};
      await supabaseAdmin
        .from("crm_bulk_campaigns")
        .update({
          total: (ex.total ?? 0) + total,
          sent: (ex.sent ?? 0) + sent,
          failed: (ex.failed ?? 0) + failed,
          skipped_no_contact: (ex.skipped_no_contact ?? 0) + skippedCount,
        } as never)
        .eq("id", campaignId);
    } else {
      await supabaseAdmin
        .from("crm_bulk_campaigns")
        .update({
          total,
          sent,
          failed,
          skipped_no_contact: skippedCount,
        } as never)
        .eq("id", campaignId);
    }

    return {
      campaign_id: campaignId,
      sent,
      failed,
      skipped: skippedCount,
      total,
      breakdown,
    };
  });

// ---------- Bulk Email ----------

const BulkEmailRecipient = z.object({
  user_id: z.string().uuid().nullable().optional(),
  email: z.string().max(255).nullable().optional(),
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
        campaign_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let campaignId = data.campaign_id ?? null;
    if (!campaignId) {
      const { data: campaign, error: cErr } = await supabaseAdmin
        .from("crm_bulk_campaigns")
        .insert({
          channel: "email",
          subject: data.subject,
          body: data.body_html,
          template_id: data.template_id ?? null,
          sender_user_id: context.userId,
          total: data.recipients.length,
        } as never)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      campaignId = (campaign as any).id as string;
    }

    // Split: skipped (no email) go straight to logs
    type Prep = { user_id: string | null; name: string | null; to_email: string; subject: string; body: string };
    const prepared: Prep[] = [];
    const skippedRows: any[] = [];
    const breakdown: BulkBreakdownRow[] = [];
    const nowIso = new Date().toISOString();

    for (const r of data.recipients) {
      const name = r.vars?.name ?? null;
      const email = (r.email ?? "").trim();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!email || !emailValid) {
        skippedRows.push({
          user_id: r.user_id ?? null,
          to_email: email || null,
          subject: data.subject,
          body_html: data.body_html,
          template_id: data.template_id ?? null,
          kind: "crm_bulk",
          attempt_no: 1,
          sender_user_id: context.userId,
          status: "skipped",
          error_reason: email ? "Invalid email format" : "No email on file",
          campaign_id: campaignId,
        });
        breakdown.push({
          user_id: r.user_id ?? null,
          contact: email || null,
          name,
          status: "skipped",
          provider_code: null,
          error_reason: email ? "Invalid email format" : "No email on file",
        });
        continue;
      }
      const rVars: BulkVars = {
        name,
        phone: r.vars?.phone ?? null,
        email,
        last_order_no: r.vars?.last_order_no ?? null,
        ltv: r.vars?.ltv ?? null,
      };
      const subject = renderVars(data.subject, rVars).trim();
      const body = renderVars(data.body_html, rVars);
      prepared.push({ user_id: r.user_id ?? null, name, to_email: email, subject, body });
    }

    const CHUNK = 10;
    const DELAY_MS = 300;
    let sent = 0;
    let failed = 0;
    const sendRows: any[] = [];

    for (let i = 0; i < prepared.length; i += CHUNK) {
      const chunk = prepared.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async (p) => {
          const wrapped = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${p.body}</body></html>`;
          try {
            const res: any = await sendEbookEmail({ to: p.to_email, subject: p.subject, html: wrapped });
            return { p, res };
          } catch (e: any) {
            return { p, res: { ok: false, error: String(e?.message ?? e) } };
          }
        }),
      );
      const now2 = new Date().toISOString();
      for (const { p, res } of results) {
        if (res.ok) sent++;
        else failed++;
        sendRows.push({
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
          sent_at: res.ok ? now2 : null,
          error_reason: res.ok ? null : res.error?.slice?.(0, 500) ?? null,
          campaign_id: campaignId,
        });
        breakdown.push({
          user_id: p.user_id,
          contact: p.to_email,
          name: p.name,
          status: res.ok ? "sent" : "failed",
          provider_code: null,
          error_reason: res.ok ? null : (res.error ?? "").slice?.(0, 200) ?? null,
        });
      }
      if (i + CHUNK < prepared.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    const allRows = [...skippedRows, ...sendRows];
    const LOG_CHUNK = 500;
    for (let i = 0; i < allRows.length; i += LOG_CHUNK) {
      const slice = allRows.slice(i, i + LOG_CHUNK);
      const { error } = await supabaseAdmin.from("crm_email_deliveries").insert(slice as never);
      if (error) console.error("[sendCrmBulkEmail] log error", error);
    }

    const skippedCount = skippedRows.length;
    const total = data.recipients.length;
    if (data.campaign_id) {
      const { data: existing } = await supabaseAdmin
        .from("crm_bulk_campaigns")
        .select("total, sent, failed, skipped_no_contact")
        .eq("id", campaignId)
        .single();
      const ex: any = existing ?? {};
      await supabaseAdmin
        .from("crm_bulk_campaigns")
        .update({
          total: (ex.total ?? 0) + total,
          sent: (ex.sent ?? 0) + sent,
          failed: (ex.failed ?? 0) + failed,
          skipped_no_contact: (ex.skipped_no_contact ?? 0) + skippedCount,
        } as never)
        .eq("id", campaignId);
    } else {
      await supabaseAdmin
        .from("crm_bulk_campaigns")
        .update({ total, sent, failed, skipped_no_contact: skippedCount } as never)
        .eq("id", campaignId);
    }

    return { campaign_id: campaignId, sent, failed, skipped: skippedCount, total, breakdown };
  });

// ---------- Gateway health ----------

export const getGatewayHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { fetchBulksmsbdBalance } = await import("@/lib/sms.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [smsHealth, emailCounts] = await Promise.all([
      fetchBulksmsbdBalance().catch((e) => ({ ok: false, balance: null, response_code: null, message: String(e?.message ?? e) })),
      (async () => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("crm_email_deliveries")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .in("status", ["sent", "delivered", "opened", "clicked", "bounced", "failed"]);
        return { last_24h: count ?? 0 };
      })(),
    ]);

    return {
      sms: {
        ok: smsHealth.ok,
        balance_bdt: smsHealth.balance,
        message: smsHealth.message,
      },
      email: emailCounts,
    };
  });

// ---------- Campaigns list / detail / retry ----------

export const listCrmCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(100).default(50) }).partial().default({}).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("crm_bulk_campaigns")
      .select("id, channel, subject, body, template_id, sender_user_id, total, sent, failed, skipped_no_contact, created_at")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const getCrmCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("crm_bulk_campaigns")
      .select("*")
      .eq("id", data.id)
      .single();
    if (cErr) throw new Error(cErr.message);

    const channel = (campaign as any).channel as "sms" | "email";
    let rows: any[] = [];
    if (channel === "sms") {
      const { data: r } = await supabaseAdmin
        .from("crm_sms_deliveries")
        .select("id, user_id, to_phone, status, provider_status, error_reason, attempt_no, created_at")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: false })
        .limit(2000);
      rows = r ?? [];
    } else {
      const { data: r } = await supabaseAdmin
        .from("crm_email_deliveries")
        .select("id, user_id, to_email, status, error_reason, attempt_no, created_at")
        .eq("campaign_id", data.id)
        .order("created_at", { ascending: false })
        .limit(2000);
      rows = r ?? [];
    }

    // Attach names via profiles
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds as string[]);
      names = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
    }

    return {
      campaign,
      channel,
      rows: rows.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        name: r.user_id ? names[r.user_id] ?? null : null,
        contact: channel === "sms" ? r.to_phone : r.to_email,
        status: r.status,
        provider_code: r.provider_status ?? null,
        error_reason: r.error_reason ?? null,
        attempt_no: r.attempt_no ?? 1,
        created_at: r.created_at,
      })),
    };
  });

/** Retry only rows classified as retryable (transient / balance / gateway errors). */
export const retryCrmCampaignFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifySmsFailure, classifyEmailFailure } = await import("@/lib/crm-bulk-report");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("crm_bulk_campaigns")
      .select("id, channel, subject, body, template_id")
      .eq("id", data.id)
      .single();
    if (cErr) throw new Error(cErr.message);
    const channel = (campaign as any).channel as "sms" | "email";

    if (channel === "sms") {
      const { data: failedRows } = await supabaseAdmin
        .from("crm_sms_deliveries")
        .select("user_id, to_phone, provider_status, error_reason, attempt_no")
        .eq("campaign_id", data.id)
        .eq("status", "failed");
      // Deduplicate by contact, keep latest attempt; only retry retryable
      const byPhone = new Map<string, any>();
      for (const r of failedRows ?? []) {
        const key = r.to_phone ?? "";
        if (!key) continue;
        const cls = classifySmsFailure(r.provider_status, r.error_reason);
        if (cls === "permanent") continue;
        const prev = byPhone.get(key);
        if (!prev || (r.attempt_no ?? 1) > (prev.attempt_no ?? 1)) byPhone.set(key, r);
      }
      const retryables = Array.from(byPhone.values());
      if (!retryables.length) return { campaign_id: data.id, sent: 0, failed: 0, skipped: 0, total: 0, breakdown: [] as any[] };
      const recipients = retryables.map((r) => ({ user_id: r.user_id, phone: r.to_phone as string, vars: {} }));
      // Recursive call would recreate a campaign — instead invoke same logic with campaign_id
      const { sendCrmBulkSms: _self } = await import("@/lib/crm-bulk.functions");
      return _self({ data: { recipients, body: (campaign as any).body, template_id: (campaign as any).template_id ?? null, campaign_id: data.id } } as any);
    } else {
      const { data: failedRows } = await supabaseAdmin
        .from("crm_email_deliveries")
        .select("user_id, to_email, error_reason, attempt_no")
        .eq("campaign_id", data.id)
        .in("status", ["failed", "bounced"]);
      const byEmail = new Map<string, any>();
      for (const r of failedRows ?? []) {
        const key = r.to_email ?? "";
        if (!key) continue;
        const cls = classifyEmailFailure(r.error_reason);
        if (cls === "permanent") continue;
        const prev = byEmail.get(key);
        if (!prev || (r.attempt_no ?? 1) > (prev.attempt_no ?? 1)) byEmail.set(key, r);
      }
      const retryables = Array.from(byEmail.values());
      if (!retryables.length) return { campaign_id: data.id, sent: 0, failed: 0, skipped: 0, total: 0, breakdown: [] as any[] };
      const recipients = retryables.map((r) => ({ user_id: r.user_id, email: r.to_email as string, vars: {} }));
      const { sendCrmBulkEmail: _self } = await import("@/lib/crm-bulk.functions");
      return _self({ data: { recipients, subject: (campaign as any).subject ?? "(no subject)", body_html: (campaign as any).body, template_id: (campaign as any).template_id ?? null, campaign_id: data.id } } as any);
    }
  });

/** Retry rows that were skipped for missing contact — pulls fresh contact from the customer profile. */
export const retryCrmCampaignSkipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("crm_bulk_campaigns")
      .select("id, channel, subject, body, template_id")
      .eq("id", data.id)
      .single();
    if (cErr) throw new Error(cErr.message);
    const channel = (campaign as any).channel as "sms" | "email";
    const table = channel === "sms" ? "crm_sms_deliveries" : "crm_email_deliveries";

    const { data: skippedRows } = await supabaseAdmin
      .from(table)
      .select("user_id")
      .eq("campaign_id", data.id)
      .eq("status", "skipped");
    const userIds = Array.from(new Set((skippedRows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    if (!userIds.length) return { campaign_id: data.id, sent: 0, failed: 0, skipped: 0, total: 0, breakdown: [] as any[] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", userIds as string[]);
    const rowsWithContact = (profiles ?? []).filter((p: any) =>
      channel === "sms" ? !!p.phone : !!p.email,
    );
    if (!rowsWithContact.length) return { campaign_id: data.id, sent: 0, failed: 0, skipped: 0, total: 0, breakdown: [] as any[] };

    if (channel === "sms") {
      const recipients = rowsWithContact.map((p: any) => ({
        user_id: p.id,
        phone: p.phone as string,
        vars: { name: p.full_name ?? null, email: p.email ?? null },
      }));
      const { sendCrmBulkSms: _self } = await import("@/lib/crm-bulk.functions");
      return _self({ data: { recipients, body: (campaign as any).body, template_id: (campaign as any).template_id ?? null, campaign_id: data.id } } as any);
    } else {
      const recipients = rowsWithContact.map((p: any) => ({
        user_id: p.id,
        email: p.email as string,
        vars: { name: p.full_name ?? null, phone: p.phone ?? null },
      }));
      const { sendCrmBulkEmail: _self } = await import("@/lib/crm-bulk.functions");
      return _self({ data: { recipients, subject: (campaign as any).subject ?? "(no subject)", body_html: (campaign as any).body, template_id: (campaign as any).template_id ?? null, campaign_id: data.id } } as any);
    }
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
          provider_status: res.response_code,
          provider_response: res.response?.slice(0, 500) ?? null,
          error_reason: res.ok ? null : res.code_label ?? res.response?.slice(0, 500) ?? null,
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
