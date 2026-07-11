/**
 * Thin Steadfast Courier API client (called from Worker's queue consumer).
 * Docs: https://docs.steadfast.com.bd/
 * Base URL: https://portal.packzy.com/api/v1
 */

export type SteadfastEnv = {
  STEADFAST_BASE_URL: string;
  STEADFAST_API_KEY: string;
  STEADFAST_SECRET_KEY: string;
};

/**
 * Payload shape Steadfast's `create_order` endpoint expects.
 * Fields:
 *   invoice           unique, max 50 chars — usually your order_no
 *   recipient_name    max 100
 *   recipient_phone   11 digits BD
 *   recipient_address max 250
 *   cod_amount        integer BDT
 *   note              optional, max 250
 *   item_description  optional
 *   total_lot         integer (sum of item quantities); default 1
 *   delivery_type     0 = home delivery, 1 = point delivery
 *   alternative_phone optional
 *   recipient_email   optional
 */
export type SteadfastCreatePayload = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot?: number;
  delivery_type?: 0 | 1;
  alternative_phone?: string;
  recipient_email?: string;
};

export type SteadfastCreateResponse = {
  status: number;
  message?: string;
  consignment?: {
    consignment_id: number | string;
    invoice: string;
    tracking_code: string;
    status: string;
  };
};

async function callSteadfast(
  env: SteadfastEnv,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${env.STEADFAST_BASE_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Api-Key": env.STEADFAST_API_KEY,
      "Secret-Key": env.STEADFAST_SECRET_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  return { status: res.status, body };
}

export function getBalance(env: SteadfastEnv) {
  return callSteadfast(env, "/get_balance", { method: "GET" });
}

export function createOrder(env: SteadfastEnv, payload: SteadfastCreatePayload) {
  return callSteadfast(env, "/create_order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Steadfast's bulk endpoint accepts up to 500 rows in one call. */
export function createOrderBulk(env: SteadfastEnv, payloads: SteadfastCreatePayload[]) {
  return callSteadfast(env, "/create_order/bulk-order", {
    method: "POST",
    body: JSON.stringify({ data: payloads }),
  });
}

export function getStatusByCid(env: SteadfastEnv, cid: string | number) {
  return callSteadfast(env, `/status_by_cid/${cid}`, { method: "GET" });
}
