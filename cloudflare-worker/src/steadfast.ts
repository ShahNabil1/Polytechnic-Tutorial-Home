/**
 * Thin Steadfast Courier API client.
 * Docs: https://docs.steadfast.com.bd/
 * Base URL: https://portal.packzy.com/api/v1
 */

export type SteadfastEnv = {
  STEADFAST_BASE_URL: string;
  STEADFAST_API_KEY: string;
  STEADFAST_SECRET_KEY: string;
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
    /* keep as text */
  }
  return { status: res.status, body };
}

export function getBalance(env: SteadfastEnv) {
  return callSteadfast(env, "/get_balance", { method: "GET" });
}
