/**
 * HMAC verification for Lovable → Worker calls.
 *
 * Contract (client side must match):
 *   Headers:
 *     x-lovable-timestamp: <unix seconds>
 *     x-lovable-signature: hex(HMAC_SHA256(secret, `${timestamp}.${method}.${path}.${bodyHash}`))
 *   bodyHash = hex(SHA256(rawBody)) — empty string for GET/no-body
 *
 * Timestamp must be within 5 minutes of server clock (replay protection).
 */

const MAX_SKEW_SEC = 5 * 60;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : "0" + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(sig);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(digest);
}

export async function verifyLovableHmac(opts: {
  secret: string;
  method: string;
  path: string;
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { secret, method, path, rawBody, timestampHeader, signatureHeader } = opts;
  if (!timestampHeader || !signatureHeader) return { ok: false, reason: "missing signature headers" };
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SEC) return { ok: false, reason: "timestamp skew too large" };
  const bodyHash = await sha256Hex(rawBody);
  const expected = await hmacSign(secret, `${ts}.${method.toUpperCase()}.${path}.${bodyHash}`);
  try {
    if (!timingSafeEqual(hexToBytes(expected), hexToBytes(signatureHeader))) {
      return { ok: false, reason: "signature mismatch" };
    }
  } catch {
    return { ok: false, reason: "malformed signature" };
  }
  return { ok: true };
}
