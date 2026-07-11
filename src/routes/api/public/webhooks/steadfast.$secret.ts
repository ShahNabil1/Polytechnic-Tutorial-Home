/**
 * Steadfast webhook receiver.
 *
 * Steadfast's webhook has no signature header, so we authenticate by
 * requiring the shared secret as a URL segment. The dashboard URL you paste
 * into Steadfast looks like:
 *
 *   https://<host>/api/public/webhooks/steadfast/<STEADFAST_WEBHOOK_SECRET>
 *
 * Payload (per Steadfast docs):
 * {
 *   notification_type: "delivery_status",
 *   consignment_id, invoice, cod_amount, status, updated_at
 * }
 */

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

type SteadfastWebhookPayload = {
  notification_type?: string;
  consignment_id?: string | number;
  invoice?: string;
  tracking_code?: string;
  cod_amount?: number;
  status?: string;
  updated_at?: string;
};

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// Map Steadfast delivery status → order / physical fulfillment status.
function mapStatusToOrderPatch(status: string): {
  order_status?: string;
  physical_status?: string;
} {
  const s = status.toLowerCase();
  if (s === "delivered") {
    return { order_status: "delivered", physical_status: "delivered" };
  }
  if (s === "partial_delivered") {
    return { order_status: "delivered", physical_status: "delivered" };
  }
  if (s === "cancelled" || s === "cancelled_approval_pending") {
    return { order_status: "cancelled", physical_status: "cancelled" };
  }
  if (s === "in_transit") {
    return { order_status: "shipped", physical_status: "shipped" };
  }
  if (s === "hold") {
    return { order_status: "hold", physical_status: "hold" };
  }
  if (
    s === "returned" ||
    s === "return_in_transit" ||
    s === "return_requested" ||
    s === "delivery_failed" ||
    s === "unknown" ||
    s === "unknown_approval_pending"
  ) {
    // Steadfast return / failed delivery → move to Returned tab
    return { order_status: "returned", physical_status: "returned" };
  }
  return {};
}

export const Route = createFileRoute("/api/public/webhooks/steadfast/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const configured = process.env.STEADFAST_WEBHOOK_SECRET;
        if (!configured) {
          console.error("STEADFAST_WEBHOOK_SECRET not configured");
          return new Response("Server not configured", { status: 500 });
        }
        const provided = String((params as { secret?: string }).secret ?? "");
        if (!safeEqual(provided, configured)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawBody = await request.text();
        let payload: SteadfastWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as SteadfastWebhookPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const status = String(payload.status ?? "").trim();
        const invoice = payload.invoice ? String(payload.invoice) : null;
        const consignmentId = payload.consignment_id ? String(payload.consignment_id) : null;
        if (!status || (!invoice && !consignmentId)) {
          return new Response("ok"); // ignore malformed but don't cause retries
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find the target order by invoice (preferred) or consignment_id.
        let order: any = null;
        if (invoice) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id, order_no, status, physical_status")
            .eq("order_no", invoice)
            .maybeSingle();
          order = data;
        }
        if (!order && consignmentId) {
          const { data } = await supabaseAdmin
            .from("orders")
            .select("id, order_no, status, physical_status")
            .eq("steadfast_consignment_id", consignmentId)
            .maybeSingle();
          order = data;
        }

        // Always log the event (order_id may be null if we can't match).
        await supabaseAdmin.from("steadfast_status_events").insert({
          order_id: order?.id ?? null,
          consignment_id: consignmentId,
          tracking_code: payload.tracking_code ?? null,
          invoice,
          status,
          raw: payload as unknown as Record<string, unknown>,
          received_at: payload.updated_at ?? new Date().toISOString(),
        } as never);

        if (order) {
          const map = mapStatusToOrderPatch(status);
          const patch: Record<string, unknown> = {
            steadfast_status: status,
            steadfast_delivery_status: status,
            steadfast_status_updated_at: payload.updated_at ?? new Date().toISOString(),
          };
          // Only advance the order status forward — don't move a delivered
          // order back to shipped, etc. Terminal states here: delivered, cancelled, returned.
          const cur = String(order.status || "");
          const isTerminal = ["delivered", "cancelled", "returned"].includes(cur);
          if (!isTerminal && map.order_status) patch.status = map.order_status;
          if (map.physical_status) patch.physical_status = map.physical_status;

          await supabaseAdmin.from("orders").update(patch as never).eq("id", order.id);
          await supabaseAdmin.rpc("recompute_order_status", { _order_id: order.id } as never);
        }

        return new Response("ok");
      },
      // Some monitoring / dashboard tools ping the URL with GET — respond
      // 200 with a hint so the developer knows the route exists.
      GET: async () => {
        return new Response("Steadfast webhook endpoint OK", { status: 200 });
      },
    },
  },
});
