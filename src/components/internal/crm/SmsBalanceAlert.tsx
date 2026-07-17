import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X, RefreshCcw, Loader2 } from "lucide-react";
import { getGatewayHealth } from "@/lib/crm-bulk.functions";

// Thresholds in BDT
const WARN_BELOW = 500;
const CRITICAL_BELOW = 100;
const POLL_MS = 5 * 60 * 1000; // 5 minutes
const DISMISS_KEY = "sms-balance-alert:dismissed-at";
const DISMISS_TTL_MS = 60 * 60 * 1000; // re-show after 1h

export type SmsHealth = {
  ok: boolean;
  balance_bdt: number | null;
  message?: string;
};

export function useSmsGatewayHealth(pollMs = POLL_MS) {
  const health = useServerFn(getGatewayHealth);
  const [sms, setSms] = useState<SmsHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const h: any = await health();
      setSms(h?.sms ?? null);
      setCheckedAt(Date.now());
    } catch {
      setSms({ ok: false, balance_bdt: null, message: "Health check failed" });
      setCheckedAt(Date.now());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sms, loading, checkedAt, refresh };
}

export function classifyBalance(sms: SmsHealth | null): "ok" | "warn" | "critical" | "unknown" {
  if (!sms) return "unknown";
  if (!sms.ok) return "critical";
  const b = sms.balance_bdt;
  if (b == null) return "unknown";
  if (b < CRITICAL_BELOW) return "critical";
  if (b < WARN_BELOW) return "warn";
  return "ok";
}

export function SmsBalanceAlert({ compact = false }: { compact?: boolean }) {
  const { sms, loading, refresh } = useSmsGatewayHealth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const at = Number(sessionStorage.getItem(DISMISS_KEY) ?? "0");
      if (at && Date.now() - at < DISMISS_TTL_MS) setDismissed(true);
    } catch { /* noop */ }
  }, []);

  const level = classifyBalance(sms);
  if (level === "ok") return null;
  if (dismissed && level !== "critical") return null;

  const isCritical = level === "critical";
  const color = isCritical
    ? "border-red-300 bg-red-50 text-red-900"
    : level === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-slate-300 bg-slate-50 text-slate-800";

  const title = isCritical
    ? (sms?.ok === false ? "SMS gateway unreachable" : "SMS balance critically low")
    : level === "warn"
      ? "SMS balance running low"
      : "SMS gateway status unknown";

  const detail = sms?.balance_bdt != null
    ? `Current balance: ৳${sms.balance_bdt.toFixed(2)}`
    : (sms?.message || "Balance not returned by gateway");

  const hint = isCritical
    ? "New bulk SMS runs will likely fail. Top up bulksmsbd before starting a campaign."
    : level === "warn"
      ? `Below ৳${WARN_BELOW}. Consider topping up before the next bulk run.`
      : "Try refreshing — the gateway may be temporarily unavailable.";

  function onDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
    setDismissed(true);
  }

  return (
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${compact ? "pt-2" : "pt-3"}`}>
      <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${color}`} role="alert">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          <div className="mt-0.5 text-xs opacity-90">
            {detail} · {hint}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-current/20 bg-white/60 px-2 py-1 text-xs font-medium hover:bg-white disabled:opacity-60"
          title="Refresh balance"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
          Refresh
        </button>
        {!isCritical && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md p-1 hover:bg-white/60"
            title="Dismiss for this session"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
