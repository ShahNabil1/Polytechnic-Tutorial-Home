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
  if (typeof body === "string") return `HTTP ${status}: ${body.slice(0, 400)}`;
  const b = body as any;
  const msg =
    b?.message ||
    b?.error ||
    (b?.errors && (typeof b.errors === "string" ? b.errors : JSON.stringify(b.errors))) ||
    "";
  return msg ? `HTTP ${status}: ${msg}` : `HTTP ${status}`;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
  const b = body as any;
  const c = b?.consignment;
  if (!c?.consignment_id || !c?.tracking_code) {
    throw new Error(normalizeError(res.status, body) || "Steadfast returned no consignment");
  }
  return {
    consignment_id: c.consignment_id,
    invoice: c.invoice ?? payload.invoice,
    tracking_code: c.tracking_code,
    status: c.status,
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
    if (r.status === "success" || r.consignment_id) {
      return {
        invoice,
        status: "success",
        consignment_id: r.consignment_id,
        tracking_code: r.tracking_code,
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
