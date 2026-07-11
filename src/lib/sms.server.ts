/**
 * Bulksmsbd SMS transport + template rendering helpers.
 * Server-only — never import from client bundles.
 */

const BULKSMSBD_ENDPOINT = "http://bulksmsbd.net/api/smsapi";

export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  let out = body ?? "";
  // Support {{newline}} placeholder from DB (avoids storing raw \n in seed literals)
  out = out.replace(/\{\{\s*newline\s*\}\}/gi, "\n");
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "gi");
    out = out.replace(re, val == null ? "" : String(val));
  }
  return out;
}

export function normalizeBdPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  return "88" + digits;
}

export async function sendBulksmsbd(opts: {
  to: string;
  message: string;
}): Promise<{ ok: boolean; status: number; response: string }> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    throw new Error("Bulksmsbd credentials not configured");
  }
  // Bulksmsbd requires type=unicode for non-ASCII (Bengali) messages.
  // Sending Bengali as "text" is accepted (marked delivered on their dashboard)
  // but carriers drop it — recipients never receive the SMS.
  const isUnicode = /[^\x00-\x7F]/.test(opts.message);
  const url = new URL(BULKSMSBD_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", isUnicode ? "unicode" : "text");
  url.searchParams.set("number", normalizeBdPhone(opts.to));
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", opts.message);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  console.log(
    `[bulksmsbd] to=${normalizeBdPhone(opts.to)} type=${isUnicode ? "unicode" : "text"} status=${res.status} resp=${text.slice(0, 200)}`,
  );
  let ok = res.ok;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.response_code && parsed.response_code !== 202) ok = false;
  } catch {
    /* text response */
  }
  return { ok, status: res.status, response: text };
}
