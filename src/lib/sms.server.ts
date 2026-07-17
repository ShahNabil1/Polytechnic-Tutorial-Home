/**
 * Bulksmsbd SMS transport + template rendering helpers.
 * Server-only — never import from client bundles.
 *
 * Response codes from bulksmsbd (returned in JSON `response_code`):
 *  202  SMS Submitted Successfully
 *  1001 Invalid Number
 *  1002 sender id not correct / sender id is disabled
 *  1003 Please Required all fields / Contact Your System Administrator
 *  1005 Internal Error
 *  1006 Balance Validity Not Available
 *  1007 Balance Insufficient
 *  1011 User Id not found
 *  1012 Masking SMS must be sent in Bengali
 *  1013 Sender Id has not found Gateway by api key
 *  1014 Sender Type Name not found using this sender by api key
 *  1015 Sender Id has not found Any Valid Gateway by api key
 *  1016 Sender Type Name Active Price Info not found by this sender id
 *  1017 Sender Type Name Price Info not found by this sender id
 *  1018 The Owner of this (username) Account is disabled
 *  1019 The (sender type name) Price of this (username) Account is disabled
 *  1020 The parent of this account is not found
 *  1021 The parent active (sender type name) price of this account is not found
 *  1031 Your Account Not Verified, Please Contact Administrator
 *  1032 IP Not whitelisted
 */

const BULKSMSBD_ENDPOINT = "https://bulksmsbd.net/api/smsapi";
const BULKSMSBD_MANY_ENDPOINT = "https://bulksmsbd.net/api/smsapimany";

export const BULKSMSBD_CODES: Record<number, string> = {
  202: "Delivered to gateway",
  1001: "Invalid number",
  1002: "Sender ID disabled",
  1003: "Missing required fields",
  1005: "Provider internal error",
  1006: "Balance validity expired",
  1007: "Insufficient balance",
  1011: "User ID not found",
  1012: "Masking SMS must be Bengali",
  1013: "Sender ID has no gateway",
  1014: "Sender type not found",
  1015: "No valid gateway for sender",
  1016: "Sender active price missing",
  1017: "Sender price info missing",
  1018: "Account disabled",
  1019: "Sender price disabled",
  1020: "Parent account not found",
  1021: "Parent price not found",
  1031: "Account not verified",
  1032: "IP not whitelisted",
};

export function bulksmsbdLabel(code: number | null | undefined): string {
  if (code == null) return "Unknown";
  return BULKSMSBD_CODES[code] ?? `Provider code ${code}`;
}

export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  let out = body ?? "";
  out = out.replace(/\{\{\s*newline\s*\}\}/gi, "\n");
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "gi");
    out = out.replace(re, val == null ? "" : String(val));
  }
  return out;
}

export function isUnicodeMessage(message: string): boolean {
  return /[^\x00-\x7F]/.test(message);
}

export function estimateSmsCount(message: string): number {
  const len = message.length;
  if (len === 0) return 0;
  if (isUnicodeMessage(message)) {
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

export function normalizeBdPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  return "88" + digits;
}

function parseBulksmsbdBody(text: string): { code: number | null; message: string | null } {
  try {
    const parsed = JSON.parse(text);
    const code =
      typeof parsed?.response_code === "number"
        ? parsed.response_code
        : typeof parsed?.response_code === "string"
          ? Number(parsed.response_code) || null
          : null;
    const message =
      parsed?.success_message ?? parsed?.error_message ?? parsed?.message ?? null;
    return { code, message: message ? String(message) : null };
  } catch {
    return { code: null, message: null };
  }
}

export type BulksmsbdResult = {
  ok: boolean;
  status: number;
  response_code: number | null;
  code_label: string;
  response: string;
};

export async function sendBulksmsbd(opts: {
  to: string;
  message: string;
}): Promise<BulksmsbdResult> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    throw new Error("Bulksmsbd credentials not configured");
  }
  const isUnicode = isUnicodeMessage(opts.message);
  const url = new URL(BULKSMSBD_ENDPOINT);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", isUnicode ? "unicode" : "text");
  url.searchParams.set("number", normalizeBdPhone(opts.to));
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", opts.message);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  const parsed = parseBulksmsbdBody(text);
  const responseCode = parsed.code;
  const ok = res.ok && responseCode === 202;
  const codeLabel =
    responseCode != null
      ? bulksmsbdLabel(responseCode)
      : parsed.message ?? (res.ok ? "Unknown response" : `HTTP ${res.status}`);
  console.log(
    `[bulksmsbd] to=${normalizeBdPhone(opts.to)} type=${isUnicode ? "unicode" : "text"} http=${res.status} code=${responseCode ?? "?"} resp=${text.slice(0, 200)}`,
  );
  return {
    ok,
    status: res.status,
    response_code: responseCode,
    code_label: codeLabel,
    response: text,
  };
}

export type BulksmsbdManyMessage = { to: string; message: string };

export type BulksmsbdManyResult = {
  ok: boolean;
  status: number;
  response_code: number | null;
  code_label: string;
  response: string;
  /** per-recipient outcomes in same order as input `messages`. */
  perMessage: Array<{ ok: boolean; response_code: number | null; code_label: string }>;
};

/**
 * Bulk send via bulksmsbd many-to-many API (`/api/smsapimany`).
 * Endpoint accepts one JSON payload with an array of `{to, message}` items.
 * Provider generally caps a request at ~100 messages — always chunk callers.
 *
 * The provider returns a single response object for the whole batch; when
 * that overall code is 202 all rows are treated as accepted. Callers can
 * inspect `response_code` per row via `perMessage` (all copies of the batch
 * code) so per-row logs stay meaningful.
 */
export async function sendBulksmsbdMany(opts: {
  messages: BulksmsbdManyMessage[];
}): Promise<BulksmsbdManyResult> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) {
    throw new Error("Bulksmsbd credentials not configured");
  }
  const payload = {
    api_key: apiKey,
    senderid: senderId,
    messages: opts.messages.map((m) => ({
      to: normalizeBdPhone(m.to),
      message: m.message,
    })),
  };
  const res = await fetch(BULKSMSBD_MANY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const parsed = parseBulksmsbdBody(text);
  const responseCode = parsed.code;
  const ok = res.ok && responseCode === 202;
  const codeLabel =
    responseCode != null
      ? bulksmsbdLabel(responseCode)
      : parsed.message ?? (res.ok ? "Unknown response" : `HTTP ${res.status}`);
  console.log(
    `[bulksmsbd:many] size=${opts.messages.length} http=${res.status} code=${responseCode ?? "?"} resp=${text.slice(0, 200)}`,
  );
  return {
    ok,
    status: res.status,
    response_code: responseCode,
    code_label: codeLabel,
    response: text,
    perMessage: opts.messages.map(() => ({
      ok,
      response_code: responseCode,
      code_label: codeLabel,
    })),
  };
}

/**
 * Fetch current bulksmsbd balance (in BDT).
 * Endpoint: GET https://bulksmsbd.net/api/getBalanceApi?api_key=XXX
 * Response is JSON like `{"response_code":202,"balance":"1234.5000","success_message":"..."}`.
 */
export async function fetchBulksmsbdBalance(): Promise<{
  ok: boolean;
  balance: number | null;
  response_code: number | null;
  message: string;
}> {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  if (!apiKey) return { ok: false, balance: null, response_code: null, message: "BULKSMSBD_API_KEY not configured" };
  const url = `https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    let balance: number | null = null;
    let responseCode: number | null = null;
    let message = "";
    try {
      const parsed = JSON.parse(text);
      if (parsed?.balance != null) balance = Number(parsed.balance);
      if (parsed?.response_code != null) responseCode = Number(parsed.response_code);
      message = String(parsed?.success_message ?? parsed?.error_message ?? parsed?.message ?? "");
    } catch {
      message = text.slice(0, 200);
    }
    return { ok: res.ok && balance != null, balance, response_code: responseCode, message };
  } catch (e: any) {
    return { ok: false, balance: null, response_code: null, message: String(e?.message ?? e) };
  }
}
