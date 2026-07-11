/**
 * Minimal Supabase REST helpers used by the Worker's queue consumer.
 * Uses SERVICE ROLE — bypasses RLS. Never expose these to the client.
 */

export type SupabaseEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function headers(env: SupabaseEnv, extra: Record<string, string> = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** PATCH public.orders where id = orderId. */
export async function updateOrder(
  env: SupabaseEnv,
  orderId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(env, { Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  return { ok: res.ok, status: res.status, body };
}

/** Append a row to order_status_history. */
export async function appendStatusHistory(
  env: SupabaseEnv,
  row: {
    order_id: string;
    from_status?: string | null;
    to_status: string;
    changed_by?: string | null;
    note?: string | null;
  },
): Promise<{ ok: boolean; status: number }> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/order_status_history`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(env, { Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  return { ok: res.ok, status: res.status };
}
