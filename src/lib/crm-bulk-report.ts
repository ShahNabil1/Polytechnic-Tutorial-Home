/**
 * Shared classification of bulk-send failures.
 * Kept out of *.server.ts / *.functions.ts so the UI can import it too.
 */

/** bulksmsbd response codes that we treat as retryable (transient / balance / gateway). */
const SMS_RETRYABLE_CODES = new Set<number>([1005, 1006, 1007, 1013, 1015, 1016, 1017, 1019, 1021, 1031, 1032]);
/** bulksmsbd response codes we treat as permanent (won't retry until fixed on customer side). */
const SMS_PERMANENT_CODES = new Set<number>([1001, 1002, 1003, 1011, 1012, 1014, 1018, 1020]);

export type FailureClass = "retryable" | "permanent" | "unknown";

export function classifySmsFailure(providerCode: number | null | undefined, reason: string | null | undefined): FailureClass {
  if (providerCode != null) {
    if (SMS_RETRYABLE_CODES.has(providerCode)) return "retryable";
    if (SMS_PERMANENT_CODES.has(providerCode)) return "permanent";
  }
  const r = (reason ?? "").toLowerCase();
  if (!r) return "unknown";
  if (/invalid|not.*valid|bad number|format/.test(r)) return "permanent";
  if (/balance|insufficient|rate|timeout|network|gateway|temporarily/.test(r)) return "retryable";
  return "unknown";
}

export function classifyEmailFailure(reason: string | null | undefined): FailureClass {
  const r = (reason ?? "").toLowerCase();
  if (!r) return "unknown";
  if (/invalid.*email|not.*valid.*email|422|bounce|does not exist|no.*mx|hard.?bounce|permanent/.test(r)) return "permanent";
  if (/429|rate.?limit|timeout|network|5\d\d|temporarily|quota/.test(r)) return "retryable";
  return "unknown";
}

/** Human-friendly short reason label for a delivery row. */
export function humanizeReason(
  channel: "sms" | "email",
  status: string,
  providerCode: number | null | undefined,
  reason: string | null | undefined,
): string {
  if (status === "skipped") {
    return channel === "sms" ? "No phone on file" : "No email on file";
  }
  if (status === "sent" || status === "delivered") return "Delivered to gateway";
  if (channel === "sms" && providerCode != null) {
    if (providerCode === 1007) return "SMS gateway balance insufficient";
    if (providerCode === 1006) return "SMS gateway balance validity expired";
    if (providerCode === 1001) return "Invalid phone number";
    if (providerCode === 1032) return "IP not whitelisted at SMS gateway";
    return reason ?? `Provider code ${providerCode}`;
  }
  return (reason ?? "").slice(0, 200) || "Unknown error";
}
