// bulksmsbd Delivery Report (DLR) receiver.
// Configure this URL in your bulksmsbd panel as the DLR callback URL:
//   https://<your-domain>/api/public/webhooks/bulksmsbd/<BULKSMSBD_DLR_SECRET>
// The gateway posts (or GETs) parameters like: to/msisdn, status, message_id, submit_date, done_date.
// We accept JSON body, form-urlencoded body, or query string.

import { createFileRoute } from "@tanstack/react-router";

type Dlr = {
  to?: string;
  msisdn?: string;
  message_id?: string;
  messageid?: string;
  status?: string; // e.g. DELIVRD, DELIVERED, UNDELIV, REJECTD, FAILED, EXPIRED
  err?: string;
  error?: string;
  done_date?: string;
  submit_date?: string;
};

const DELIVERED_TOKENS = new Set(["DELIVRD", "DELIVERED", "DELIVERD", "DLVRD", "SENT", "OK", "1"]);
const FAILED_TOKENS = new Set([
  "UNDELIV", "UNDELIVERED", "UNDELIVR", "REJECTD", "REJECTED",
  "FAILED", "FAIL", "EXPIRED", "DELETED", "UNKNOWN", "0",
]);

function normStatus(s: string | undefined | null): "delivered" | "failed" | null {
  if (!s) return null;
  const t = String(s).trim().toUpperCase();
  if (DELIVERED_TOKENS.has(t)) return "delivered";
  if (FAILED_TOKENS.has(t)) return "failed";
  return null;
}

function normalizeBdPhone(p: string | undefined | null): string | null {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-11); // last 11 digits (01XXXXXXXXX)
}

async function parseBody(request: Request): Promise<Dlr[]> {
  const url = new URL(request.url);
  const q: Dlr = Object.fromEntries(url.searchParams.entries());
  const hasQuery = Object.keys(q).length > 0;

  if (request.method === "GET") {
    return hasQuery ? [q] : [];
  }

  const ct = (request.headers.get("content-type") || "").toLowerCase();
  const raw = await request.text();
  if (!raw) return hasQuery ? [q] : [];

  if (ct.includes("application/json")) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j as Dlr[];
      // bulksmsbd sometimes wraps in { reports: [...] }
      if (Array.isArray((j as any).reports)) return (j as any).reports as Dlr[];
      return [j as Dlr];
    } catch {
      return hasQuery ? [q] : [];
    }
  }

  // form-urlencoded or plain
  try {
    const params = new URLSearchParams(raw);
    const o: Dlr = Object.fromEntries(params.entries());
    return [o];
  } catch {
    return hasQuery ? [q] : [];
  }
}

async function handleReports(reports: Dlr[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let updated = 0;

  for (const r of reports) {
    const status = normStatus(r.status);
    if (!status) continue;

    const messageId = (r.message_id ?? r.messageid ?? "").trim() || null;
    const phone = normalizeBdPhone(r.to ?? r.msisdn);
    const errText = (r.err ?? r.error ?? "").toString().slice(0, 500) || null;
    const doneAt = r.done_date ? new Date(r.done_date) : new Date();
    const doneIso = isNaN(doneAt.getTime()) ? new Date().toISOString() : doneAt.toISOString();

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "delivered") {
      patch.delivered_at = doneIso;
      patch.error_reason = null;
    } else {
      patch.error_reason = errText ?? r.status ?? "Undelivered";
    }

    // Prefer matching by provider_message_id
    let matched = false;
    if (messageId) {
      const { data, error } = await supabaseAdmin
        .from("crm_sms_deliveries")
        .update(patch as never)
        .eq("provider_message_id", messageId)
        .select("id");
      if (!error && data && data.length > 0) {
        updated += data.length;
        matched = true;
      }
    }

    // Fallback: match latest 'sent' row by phone within the last 7 days
    if (!matched && phone) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: candidate } = await supabaseAdmin
        .from("crm_sms_deliveries")
        .select("id")
        .eq("to_phone", phone)
        .eq("status", "sent")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (candidate?.id) {
        const { error } = await supabaseAdmin
          .from("crm_sms_deliveries")
          .update(patch as never)
          .eq("id", candidate.id);
        if (!error) updated += 1;
      }
    }
  }
  return updated;
}

export const Route = createFileRoute("/api/public/webhooks/bulksmsbd/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expected = process.env.BULKSMSBD_DLR_SECRET;
        if (!expected) return new Response("Server not configured", { status: 500 });
        if (params.secret !== expected) return new Response("Invalid secret", { status: 401 });

        const reports = await parseBody(request);
        const updated = await handleReports(reports);
        return Response.json({ ok: true, received: reports.length, updated });
      },
      GET: async ({ request, params }) => {
        const expected = process.env.BULKSMSBD_DLR_SECRET;
        if (!expected) return new Response("Server not configured", { status: 500 });
        if (params.secret !== expected) return new Response("Invalid secret", { status: 401 });

        const reports = await parseBody(request);
        const updated = await handleReports(reports);
        return Response.json({ ok: true, received: reports.length, updated });
      },
    },
  },
});
