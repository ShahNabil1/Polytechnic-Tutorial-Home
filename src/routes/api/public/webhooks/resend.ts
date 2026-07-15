// Resend webhook receiver. Verifies svix signature and updates order_email_deliveries
// + orders.digital_status. Public route — do all authorization here.

import { createFileRoute } from "@tanstack/react-router";

type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.delivery_delayed"
  | "email.failed"
  | "email.opened"
  | "email.clicked"
  | "email.scheduled";

type ResendPayload = {
  type: ResendEventType;
  created_at?: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    // bounce
    bounce?: { type?: string; message?: string; subType?: string };
    // failed / delayed reason
    failed?: { reason?: string };
    reason?: string;
    // clicked
    click?: { link?: string };
  };
};

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (!secret) {
          console.error("RESEND_WEBHOOK_SECRET not configured");
          return new Response("Server not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const { verifyResendSignature } = await import("@/lib/ebook-delivery.server");
        const ok = await verifyResendSignature(rawBody, request.headers, secret);
        if (!ok) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: ResendPayload;
        try {
          payload = JSON.parse(rawBody) as ResendPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const emailId = payload.data?.email_id;
        if (!emailId) {
          return new Response("ok"); // ignore malformed
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find delivery row by resend_email_id (return order_id for status recompute)
        const { data: delivery } = await supabaseAdmin
          .from("order_email_deliveries")
          .select("id, order_id, attempt_no")
          .eq("resend_email_id", emailId)
          .order("attempt_no", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!delivery) {
          // Not an order email — check internal (welcome / staff) deliveries.
          const { data: internal } = await supabaseAdmin
            .from("internal_email_deliveries")
            .select("id")
            .eq("resend_email_id", emailId)
            .limit(1)
            .maybeSingle();

          if (!internal) {
            return new Response("ok"); // unknown email; ack silently
          }

          const nowIsoI = new Date().toISOString();
          const patchI: Record<string, unknown> = { provider_payload: payload };
          switch (payload.type) {
            case "email.sent":
              patchI.status = "sent";
              patchI.sent_at = payload.created_at ?? nowIsoI;
              break;
            case "email.delivered":
              patchI.status = "delivered";
              patchI.delivered_at = payload.created_at ?? nowIsoI;
              break;
            case "email.opened":
              patchI.status = "opened";
              patchI.opened_at = payload.created_at ?? nowIsoI;
              break;
            case "email.clicked":
              patchI.status = "clicked";
              patchI.clicked_at = payload.created_at ?? nowIsoI;
              break;
            case "email.bounced":
              patchI.status = "bounced";
              patchI.bounced_at = payload.created_at ?? nowIsoI;
              patchI.bounce_type = payload.data.bounce?.type ?? null;
              patchI.error_reason =
                payload.data.bounce?.message ?? payload.data.bounce?.type ?? "bounced";
              break;
            case "email.delivery_delayed":
              patchI.status = "delayed";
              patchI.error_reason = payload.data.reason ?? "delivery delayed";
              break;
            case "email.failed":
              patchI.status = "failed";
              patchI.error_reason =
                payload.data.failed?.reason ?? payload.data.reason ?? "failed";
              break;
            case "email.scheduled":
              patchI.status = "scheduled";
              break;
          }
          await supabaseAdmin
            .from("internal_email_deliveries")
            .update(patchI as never)
            .eq("id", internal.id);
          return new Response("ok");
        }

        const nowIso = new Date().toISOString();
        const patch: Record<string, unknown> = { provider_payload: payload };

        switch (payload.type) {
          case "email.sent":
            patch.status = "sent";
            patch.sent_at = payload.created_at ?? nowIso;
            break;
          case "email.delivered":
            patch.status = "delivered";
            patch.delivered_at = payload.created_at ?? nowIso;
            break;
          case "email.opened":
            patch.status = "opened";
            patch.opened_at = payload.created_at ?? nowIso;
            break;
          case "email.clicked":
            patch.status = "clicked";
            patch.clicked_at = payload.created_at ?? nowIso;
            break;
          case "email.bounced":
            patch.status = "bounced";
            patch.bounced_at = payload.created_at ?? nowIso;
            patch.bounce_type = payload.data.bounce?.type ?? null;
            patch.error_reason = payload.data.bounce?.message ?? payload.data.bounce?.type ?? "bounced";
            break;
          case "email.delivery_delayed":
            patch.status = "delayed";
            patch.error_reason = payload.data.reason ?? "delivery delayed";
            break;
          case "email.failed":
            patch.status = "failed";
            patch.error_reason = payload.data.failed?.reason ?? payload.data.reason ?? "failed";
            break;
          case "email.scheduled":
            patch.status = "scheduled";
            break;
        }

        await supabaseAdmin
          .from("order_email_deliveries")
          .update(patch as never)
          .eq("id", delivery.id);

        // Reflect on order.digital_status for terminal outcomes.
        const orderPatch: Record<string, unknown> = {};
        if (payload.type === "email.delivered") {
          orderPatch.digital_status = "delivered";
          orderPatch.digital_delivered_at = payload.created_at ?? nowIso;
          orderPatch.digital_last_error = null;
        } else if (payload.type === "email.bounced") {
          // Schedule retry unless we've exhausted attempts.
          const nextRetry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          orderPatch.digital_status = "bounced";
          orderPatch.digital_last_error = String(patch.error_reason ?? "bounced");
          orderPatch.digital_next_retry_at = nextRetry;
        } else if (payload.type === "email.failed") {
          const nextRetry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          orderPatch.digital_status = "failed";
          orderPatch.digital_last_error = String(patch.error_reason ?? "failed");
          orderPatch.digital_next_retry_at = nextRetry;
        } else if (payload.type === "email.delivery_delayed") {
          orderPatch.digital_status = "delayed";
          orderPatch.digital_last_error = String(patch.error_reason ?? "delayed");
        }

        if (Object.keys(orderPatch).length > 0) {
          await supabaseAdmin
            .from("orders")
            .update(orderPatch as never)
            .eq("id", delivery.order_id);
        }

        if (payload.type === "email.delivered") {
          await supabaseAdmin.rpc("recompute_order_status", { _order_id: delivery.order_id } as never);
        }

        return new Response("ok");
      },
    },
  },
});
