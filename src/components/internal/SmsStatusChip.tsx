/**
 * SMS delivery status chips — Resend-style visual feedback for
 * every SMS row (order confirmation, CRM manual, CRM bulk).
 *
 * Reads `status` + `provider_status` (bulksmsbd response_code) +
 * `error_reason` to render a coloured chip with a human label
 * plus a tooltip pointing at the exact provider failure.
 */
import { cn } from "@/lib/utils";

// Keep the code→label map in sync with sms.server.ts BULKSMSBD_CODES.
// Duplicated here so this component can stay client-safe.
const CODE_LABEL: Record<number, string> = {
  202: "Delivered to gateway",
  1001: "Invalid number",
  1002: "Sender ID disabled",
  1003: "Missing fields",
  1005: "Provider error",
  1006: "Balance expired",
  1007: "Insufficient balance",
  1011: "User ID not found",
  1012: "Must be Bengali",
  1013: "No gateway",
  1014: "Sender type missing",
  1015: "No valid gateway",
  1016: "Price info missing",
  1017: "Price info missing",
  1018: "Account disabled",
  1019: "Price disabled",
  1020: "Parent missing",
  1021: "Parent price missing",
  1031: "Not verified",
  1032: "IP not whitelisted",
};

function toneFor(code: number | null | undefined, status: string): string {
  if (code === 202 || status === "sent")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (code === 1007 || code === 1006)
    return "bg-amber-50 text-amber-700 ring-amber-200";
  if (code === 1001 || code === 1012)
    return "bg-orange-50 text-orange-700 ring-orange-200";
  if (code === 1032 || code === 1031 || code === 1018)
    return "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

export function SmsStatusChip({
  status,
  providerStatus,
  errorReason,
  className,
}: {
  status: string;
  providerStatus?: number | null;
  errorReason?: string | null;
  className?: string;
}) {
  const code = providerStatus ?? null;
  const label =
    (code != null && CODE_LABEL[code]) ||
    (status === "sent" ? "Delivered to gateway" : status === "failed" ? "Failed" : status);
  const title =
    code != null
      ? `Provider code ${code}${errorReason ? ` · ${errorReason}` : ""}`
      : errorReason ?? label;
  return (
    <span
      title={title}
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1",
        toneFor(code, status),
        className,
      )}
    >
      {label}
      {code != null && code !== 202 && (
        <span className="ml-1 opacity-70">#{code}</span>
      )}
    </span>
  );
}
