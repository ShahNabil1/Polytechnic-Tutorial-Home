/**
 * Server-only Upstash Redis cache helpers.
 *
 * Fail-open: if Redis is unreachable or misconfigured, all helpers behave as
 * cache misses / no-ops and log a warning. Callers must always fall through
 * to the underlying data source.
 *
 * Import only from server-only code (`*.server.ts`, or inside a
 * `createServerFn` handler via dynamic import). Never top-level import from
 * route files or `*.functions.ts` — this file reads `process.env` and pulls
 * `@upstash/redis`, which must not ship to the client bundle.
 */
import { Redis } from "@upstash/redis";

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[cache] Upstash Redis env vars missing — caching disabled");
    _redis = null;
    return _redis;
  }
  try {
    _redis = new Redis({ url, token });
  } catch (err) {
    console.warn("[cache] Failed to init Upstash client:", err);
    _redis = null;
  }
  return _redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get<T>(key);
    return (v as T) ?? null;
  } catch (err) {
    console.warn(`[cache] GET ${key} failed:`, err);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value as any, { ex: Math.max(1, Math.floor(ttlSec)) });
  } catch (err) {
    console.warn(`[cache] SET ${key} failed:`, err);
  }
}

export async function cacheDel(keys: string | string[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const list = Array.isArray(keys) ? keys : [keys];
  if (list.length === 0) return;
  try {
    await r.del(...list);
  } catch (err) {
    console.warn(`[cache] DEL failed:`, err);
  }
}

/**
 * Delete every key matching a prefix using SCAN. Safe on production —
 * SCAN is non-blocking. Batched deletes in chunks of 500.
 */
export async function cacheDelPrefix(prefix: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const pattern = `${prefix}*`;
  try {
    let cursor: string | number = 0;
    const batch: string[] = [];
    // Upstash SCAN returns [nextCursor, keys]
    do {
      const [next, keys] = (await r.scan(cursor, { match: pattern, count: 200 })) as [
        string | number,
        string[],
      ];
      cursor = next;
      if (keys && keys.length) {
        batch.push(...keys);
        if (batch.length >= 500) {
          await r.del(...batch.splice(0, batch.length));
        }
      }
    } while (String(cursor) !== "0");
    if (batch.length) await r.del(...batch);
  } catch (err) {
    console.warn(`[cache] DEL prefix ${prefix} failed:`, err);
  }
}

/**
 * Cache-aside wrapper. Reads from Redis; on miss runs `loader`, stores the
 * result, and returns it. Loader errors are surfaced to the caller.
 */
export async function withCache<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await loader();
  // fire-and-forget the write; don't block the response on cache write failures
  void cacheSet(key, fresh, ttlSec);
  return fresh;
}
