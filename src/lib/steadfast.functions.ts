/**
 * Steadfast dispatch server functions.
 *
 * Contract:
 * - `retrySteadfastDispatch` — single order retry (from "Failed RTS" alert).
 * - `bulkDispatchToSteadfast` — chunks the input into 10-order calls to the
 *   Steadfast bulk API, retries failed ones up to 3 times, and reports
 *   per-order results back to the caller (which drives the progress UI).
 *
 * Rules honored:
 * - item_description + total_lot count PHYSICAL items only (ebook lines are
 *   excluded, so mix orders never send digital titles to the courier).
 * - Successes stamp `steadfast_consignment_id`, `steadfast_tracking_code`,
 *   `steadfast_synced_at`, clear `steadfast_last_error`, and move the order
 *   to `ready_to_ship` + `physical_status='ready_to_ship'`.
 * - Failures leave the order in `processing`, store the exact courier error
 *   in `steadfast_last_error`, and increment `steadfast_retry_count`.
 *
 * Helpers (`buildPayloadFromOrder`, `dispatchOrderById`) live in
 * `steadfast.server.ts` because TSS server-fn splitting strips module-scope
 * helpers that live next to the handler declaration.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(context: { supabase: any; userId: string }) {
  const [{ data: isEmp }, { data: isAdm }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "employee" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!isEmp && !isAdm) throw new Error("Forbidden");
}

/** Manually retry a single failed dispatch (Failed RTS badge → Retry button). */
export const retrySteadfastDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchOrderById } = await import("@/lib/steadfast.server");
    const res = await dispatchOrderById(supabaseAdmin, data.id);
    if (!res.ok) throw new Error(res.error || "Dispatch failed");
    return res;
  });

/**
 * Bulk dispatch — used by the Processing-tab "Send to Steadfast" flow.
 * Splits into chunks of 10, calls Steadfast bulk API, retries the failed
 * invoices up to 3 more times, and returns a per-order status list the UI
 * uses to render the progress bar.
 */
export const bulkDispatchToSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderIds: z.array(z.string().uuid()).min(1).max(500),
        chunkSize: z.number().int().min(1).max(50).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createBulkOrders, buildPayloadFromOrder } = await import("@/lib/steadfast.server");
    const chunkSize = data.chunkSize ?? 10;

    // 1. Load all target orders + items in one round-trip each.
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("id", data.orderIds);
    const { data: allItems } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .in("order_id", data.orderIds);

    const byOrder: Record<string, any[]> = {};
    for (const it of allItems ?? []) {
      (byOrder[it.order_id] ??= []).push(it);
    }

    // 2. Filter to eligible orders (physical, not already dispatched).
    type Row = {
      orderId: string;
      orderNo: string;
      payload: any;
      ok: boolean;
      error?: string;
      consignmentId?: string;
      trackingCode?: string;
    };
    const rows: Row[] = [];
    const invoiceIndex = new Map<string, Row>();
    for (const o of orders ?? []) {
      if (!o.has_physical) {
        rows.push({
          orderId: o.id,
          orderNo: o.order_no,
          payload: {},
          ok: false,
          error: "Order has no physical items",
        });
        continue;
      }
      if (o.steadfast_consignment_id) {
        rows.push({
          orderId: o.id,
          orderNo: o.order_no,
          payload: {},
          ok: true,
          consignmentId: String(o.steadfast_consignment_id),
          trackingCode: o.steadfast_tracking_code ?? undefined,
        });
        continue;
      }
      const payload = buildPayloadFromOrder(o, byOrder[o.id] ?? []);
      const row: Row = { orderId: o.id, orderNo: o.order_no, payload, ok: false };
      rows.push(row);
      invoiceIndex.set(payload.invoice, row);
    }

    // 3. Dispatch pending rows in chunks. Retry failed ones up to 3 times.
    async function runPass(pending: Row[]) {
      for (let i = 0; i < pending.length; i += chunkSize) {
        const slice = pending.slice(i, i + chunkSize);
        try {
          const results = await createBulkOrders(slice.map((r) => r.payload));
          for (const r of results) {
            const row = invoiceIndex.get(r.invoice);
            if (!row) continue;
            if (r.status === "success" && r.consignment_id) {
              row.ok = true;
              row.consignmentId = String(r.consignment_id);
              row.trackingCode = r.tracking_code;
              row.error = undefined;
            } else {
              row.ok = false;
              row.error = r.message || "Unknown error";
            }
          }
        } catch (err: any) {
          for (const s of slice) {
            s.ok = false;
            s.error = String(err?.message ?? err).slice(0, 500);
          }
        }
      }
    }

    const dispatchable = rows.filter((r) => r.payload.invoice);
    await runPass(dispatchable);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const failed = dispatchable.filter((r) => !r.ok);
      if (!failed.length) break;
      await new Promise((res) => setTimeout(res, 400 * attempt));
      await runPass(failed);
    }

    // 4. Persist per-order results.
    const nowIso = new Date().toISOString();
    for (const r of rows) {
      if (!r.payload.invoice && r.ok) continue; // already-dispatched pass-through
      if (r.ok) {
        await supabaseAdmin
          .from("orders")
          .update({
            steadfast_consignment_id: r.consignmentId,
            steadfast_tracking_code: r.trackingCode,
            steadfast_status: "in_review",
            steadfast_delivery_status: "in_review",
            steadfast_synced_at: nowIso,
            steadfast_last_error: null,
            status: "ready_to_ship",
            physical_status: "ready_to_ship",
          })
          .eq("id", r.orderId);
      } else if (r.payload.invoice) {
        await supabaseAdmin
          .from("orders")
          .update({
            steadfast_last_error: r.error ?? "Unknown error",
          })
          .eq("id", r.orderId);
      }
    }

    return {
      total: rows.length,
      succeeded: rows.filter((r) => r.ok).length,
      failed: rows.filter((r) => !r.ok).length,
      results: rows.map((r) => ({
        orderId: r.orderId,
        orderNo: r.orderNo,
        ok: r.ok,
        error: r.error,
        consignmentId: r.consignmentId,
        trackingCode: r.trackingCode,
      })),
    };
  });
