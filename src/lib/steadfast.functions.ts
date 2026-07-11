import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sign & call the standalone Cloudflare Worker (pth-steadfast).
 *
 * Contract must match cloudflare-worker/src/hmac.ts:
 *   x-lovable-timestamp: <unix seconds>
 *   x-lovable-signature: hex(HMAC_SHA256(secret, `${ts}.${METHOD}.${path}.${sha256Hex(body)}`))
 */

function bytesToHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(digest);
}

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return bytesToHex(sig);
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

async function callWorker(opts: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<{ status: number; data: JsonValue }> {
  const base = process.env.STEADFAST_WORKER_URL;
  const secret = process.env.LOVABLE_HMAC_SECRET;
  if (!base) throw new Error("STEADFAST_WORKER_URL is not configured");
  if (!secret) throw new Error("LOVABLE_HMAC_SECRET is not configured");

  const url = `${base.replace(/\/$/, "")}${opts.path}`;
  const rawBody = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const bodyHash = await sha256Hex(rawBody);
  const signature = await hmacSha256Hex(
    secret,
    `${ts}.${opts.method}.${opts.path}.${bodyHash}`,
  );

  const res = await fetch(url, {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      "x-lovable-timestamp": ts,
      "x-lovable-signature": signature,
    },
    body: opts.method === "GET" ? undefined : rawBody,
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: res.status, data };
}

/**
 * Step 1: Steadfast balance check. Employee/super_admin only.
 */
export const getSteadfastBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [isEmployee, isSuper] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "employee" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!(isEmployee.data || isSuper.data)) throw new Error("Forbidden");

    const { status, data } = await callWorker({
      method: "GET",
      path: "/api/steadfast/balance",
    });
    return { status, data };
  });
