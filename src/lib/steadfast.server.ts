/**
 * Steadfast Courier API client (server-only).
 * Docs: portal.packzy.com — Merchant API v1.
 *
 * We call three endpoints:
 *   POST /create_order              — single consignment
 *   POST /create_order/bulk-order   — up to 500 consignments in one call
 *   GET  /status_by_invoice/{inv}   — retry polling / manual check
 *
 * Excluded (per product decision):
 *   balance, payments, payments/consignments, police-station lookup.
 */

const DEFAULT_BASE = "https://portal.packzy.com/api/v1";
const TIMEOUT_MS = 20_000;

function baseUrl(): string {
  return (process.env.STEADFAST_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function headers(): HeadersInit {
  const apiKey = process.env.STEADFAST_API_KEY;
  const secret = process.env.STEADFAST_SECRET_KEY;
  if (!apiKey || !secret) {
    throw new Error("Steadfast credentials missing (STEADFAST_API_KEY / STEADFAST_SECRET_KEY).");
  }
  return {
    "Api-Key": apiKey,
    "Secret-Key": secret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function withTimeout<T>(p: Promise<T>): Promise<T> {
  return await Promise.race<T>([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Steadfast API request timed out")), TIMEOUT_MS),
    ),
  ]);
}

export type SteadfastSinglePayload = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  alternative_phone?: string;
  recipient_email?: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot: number;
  delivery_type: 0 | 1;
};

export type SteadfastConsignment = {
  consignment_id: string | number;
  invoice: string;
  tracking_code: string;
  status?: string;
};

export type SteadfastBulkResultRow = {
  invoice: string;
  status: "success" | "error" | string;
  consignment_id?: string | number;
  tracking_code?: string;
  message?: string;
  errors?: unknown;
};

function normalizeError(status: number, body: unknown): string {
  if (typeof body === "string") return status >= 200 && status < 300 ? body.slice(0, 400) : `HTTP ${status}: ${body.slice(0, 400)}`;
  const b = body as any;
  const row = findResponseRow(b);
  const msg =
    row?.message ||
    row?.error ||
    (row?.errors && (typeof row.errors === "string" ? row.errors : JSON.stringify(row.errors))) ||
    b?.message ||
    b?.error ||
    (b?.errors && (typeof b.errors === "string" ? b.errors : JSON.stringify(b.errors))) ||
    "";
  return msg ? (status >= 200 && status < 300 ? msg : `HTTP ${status}: ${msg}`) : `HTTP ${status}`;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function findResponseRow(body: any, invoice?: string): any | null {
  if (Array.isArray(body?.data)) {
    return (
      body.data.find((r: any) => String(r?.invoice ?? r?.Invoice ?? "") === invoice) ??
      body.data[0] ??
      null
    );
  }
  return body?.data ?? body ?? null;
}

function readConsignment(value: any): SteadfastConsignment | null {
  const c = value?.consignment ?? value;
  const consignmentId = c?.consignment_id ?? c?.consignmentId;
  const trackingCode = c?.tracking_code ?? c?.trackingCode;
  if (!consignmentId || !trackingCode) return null;
  return {
    consignment_id: consignmentId,
    invoice: String(c.invoice ?? value?.invoice ?? ""),
    tracking_code: String(trackingCode),
    status: c.delivery_status ?? c.status,
  };
}

function extractConsignment(body: unknown, invoice: string): SteadfastConsignment | null {
  const b = body as any;
  const candidates: any[] = [b?.consignment, b?.data?.consignment, b?.data, b];
  if (Array.isArray(b?.data)) {
    const exact = b.data.filter((r: any) => String(r?.invoice ?? r?.Invoice ?? "") === invoice);
    candidates.unshift(...exact);
    candidates.push(...b.data);
  }
  for (const candidate of candidates) {
    const consignment = readConsignment(candidate);
    if (consignment) return { ...consignment, invoice: consignment.invoice || invoice };
  }
  return null;
}

function normalizeDeliveryStatus(status: string | undefined): string {
  // Bulk-style rows use `status: "success"` to mean API success, not courier
  // delivery state. Store the initial Steadfast delivery state consistently.
  return !status || status === "success" ? "in_review" : status;
}

/**
 * Create a single consignment. Returns the consignment on success,
 * throws Error with the exact Steadfast error message on failure.
 */
export async function createSingleOrder(
  payload: SteadfastSinglePayload,
): Promise<SteadfastConsignment> {
  const res = await withTimeout(
    fetch(`${baseUrl()}/create_order`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    }),
  );
  const body = await readBody(res);
  if (!res.ok) throw new Error(normalizeError(res.status, body));
  const c = extractConsignment(body, payload.invoice);
  if (!c) {
    throw new Error(normalizeError(res.status, body) || "Steadfast returned no consignment");
  }
  return {
    consignment_id: c.consignment_id,
    invoice: c.invoice || payload.invoice,
    tracking_code: c.tracking_code,
    status: normalizeDeliveryStatus(c.status),
  };
}

/**
 * Create up to 500 consignments in one call. Result rows come back matched by
 * invoice; each row is either success (with consignment_id + tracking_code) or
 * error (with message). Network / auth failures throw.
 */
export async function createBulkOrders(
  payloads: SteadfastSinglePayload[],
): Promise<SteadfastBulkResultRow[]> {
  if (!payloads.length) return [];
  const res = await withTimeout(
    fetch(`${baseUrl()}/create_order/bulk-order`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ data: payloads }),
    }),
  );
  const body = await readBody(res);
  if (!res.ok) throw new Error(normalizeError(res.status, body));
  const b = body as any;
  const rows: any[] = Array.isArray(b?.data) ? b.data : Array.isArray(b) ? b : [];
  if (!rows.length) {
    // Some Steadfast responses wrap under different keys — fall back to marking all failed.
    return payloads.map((p) => ({
      invoice: p.invoice,
      status: "error",
      message: normalizeError(res.status, body) || "Unrecognized bulk response",
    }));
  }
  return rows.map((r) => {
    const invoice = String(r.invoice ?? r.Invoice ?? "");
    const c = readConsignment(r);
    if ((r.status === "success" || c?.consignment_id) && c) {
      return {
        invoice: invoice || c.invoice,
        status: "success",
        consignment_id: c.consignment_id,
        tracking_code: c.tracking_code,
      };
    }
    const message =
      r.message ||
      r.error ||
      (r.errors && (typeof r.errors === "string" ? r.errors : JSON.stringify(r.errors))) ||
      "Unknown error";
    return { invoice, status: "error", message };
  });
}

export async function getStatusByInvoice(invoice: string): Promise<string | null> {
  const res = await withTimeout(
    fetch(`${baseUrl()}/status_by_invoice/${encodeURIComponent(invoice)}`, {
      method: "GET",
      headers: headers(),
    }),
  );
  const body = await readBody(res);
  if (!res.ok) return null;
  const b = body as any;
  return (b?.delivery_status as string) ?? null;
}

// -------- shared helpers (imported by steadfast.functions.ts) --------
// Kept here (not in .functions.ts) so `createServerFn().handler(...)` bodies
// can safely call them — TSS server-fn splitting strips module-scope helpers
// that live next to the handler declaration.

export function buildPayloadFromOrder(order: any, items: any[]): SteadfastSinglePayload {
  const physical = items.filter((i) => i.item_type !== "ebook");
  const totalLot = physical.reduce((s, i) => s + Number(i.quantity || 0), 0) || 1;
  const desc =
    (order.item_description as string | null) ||
    physical.map((i) => `${i.title} x${i.quantity}`).join(", ").slice(0, 500);
  const address =
    order.full_address ||
    [order.address_line, order.thana, order.district, order.division].filter(Boolean).join(", ") ||
    "N/A";

  const payload: SteadfastSinglePayload = {
    invoice: order.order_no,
    recipient_name: order.customer_name,
    recipient_phone: order.customer_phone,
    recipient_address: String(address).slice(0, 250),
    cod_amount: Number(order.cod_amount ?? order.total_bdt ?? 0),
    total_lot: totalLot,
    delivery_type: 0,
    item_description: desc,
  };
  if (order.alternative_phone) payload.alternative_phone = order.alternative_phone;
  if (order.customer_email) payload.recipient_email = order.customer_email;
  if (order.note) payload.note = order.note;
  return payload;
}

export async function dispatchOrderById(
  sbAdmin: any,
  orderId: string,
): Promise<{ ok: boolean; error?: string; consignmentId?: string; trackingCode?: string }> {
  const [{ data: order }, { data: items }] = await Promise.all([
    sbAdmin.from("orders").select("*").eq("id", orderId).single(),
    sbAdmin.from("order_items").select("*").eq("order_id", orderId),
  ]);
  if (!order) return { ok: false, error: "Order not found" };
  if (!order.has_physical) return { ok: false, error: "Order has no physical items to ship" };
  if (order.steadfast_consignment_id) {
    return {
      ok: true,
      consignmentId: String(order.steadfast_consignment_id),
      trackingCode: order.steadfast_tracking_code ?? undefined,
    };
  }

  try {
    const payload = buildPayloadFromOrder(order, items ?? []);
    const c = await createSingleOrder(payload);
    await sbAdmin
      .from("orders")
      .update({
        steadfast_consignment_id: String(c.consignment_id),
        steadfast_tracking_code: c.tracking_code,
        steadfast_status: c.status ?? "in_review",
        steadfast_delivery_status: c.status ?? "in_review",
        steadfast_synced_at: new Date().toISOString(),
        steadfast_last_error: null,
        status: "ready_to_ship",
        physical_status: "ready_to_ship",
      })
      .eq("id", orderId);
    return {
      ok: true,
      consignmentId: String(c.consignment_id),
      trackingCode: c.tracking_code,
    };
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "Unknown Steadfast error").slice(0, 500);
    await sbAdmin
      .from("orders")
      .update({
        steadfast_last_error: msg,
        steadfast_retry_count: (order.steadfast_retry_count ?? 0) + 1,
      })
      .eq("id", orderId);
    return { ok: false, error: msg };
  }
}
