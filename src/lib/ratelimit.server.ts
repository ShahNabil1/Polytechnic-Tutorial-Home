/**
 * Server-only rate limiting via Upstash Ratelimit.
 *
 * Fail-open: if Redis is unreachable, the limiter returns `success: true` and
 * logs a warning. Callers must never treat this as a hard security control —
 * it's abuse mitigation, not authentication.
 *
 * Import only from server-only code (via dynamic import inside handlers).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redis = null;
    return null;
  }
  try {
    _redis = new Redis({ url, token });
  } catch {
    _redis = null;
  }
  return _redis;
}

const cache = new Map<string, Ratelimit>();

/**
 * Build (or reuse) a sliding-window limiter.
 * `limit` = max requests, `window` = e.g. "10 s", "1 m", "1 h".
 */
export function getLimiter(name: string, limit: number, window: `${number} ${"s" | "m" | "h"}`): Ratelimit | null {
  const key = `${name}:${limit}:${window}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const redis = getRedis();
  if (!redis) return null;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${name}`,
    analytics: false,
  });
  cache.set(key, rl);
  return rl;
}

/**
 * Best-effort identifier from the incoming request. Prefers explicit IP,
 * falls back to Cloudflare / forwarded headers, then to `"unknown"`.
 * Call inside a server function or server route handler.
 */
export function requestIdentifier(): string {
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) return ip;
  } catch {}
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf;
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  } catch {}
  return "unknown";
}

/**
 * Throws a 429-ish Error when the identifier has exceeded its budget.
 * Fail-open: if Redis is missing or errors, the call succeeds and logs.
 */
export async function enforceRateLimit(
  name: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h"}`,
  identifier?: string,
): Promise<void> {
  const rl = getLimiter(name, limit, window);
  if (!rl) return;
  const id = identifier ?? requestIdentifier();
  try {
    const { success, reset } = await rl.limit(id);
    if (!success) {
      const wait = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
      throw new Error(`অনেক বার চেষ্টা করেছেন — ${wait}s পরে আবার চেষ্টা করুন`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("অনেক বার")) throw err;
    console.warn(`[ratelimit] ${name} check failed:`, err);
  }
}
