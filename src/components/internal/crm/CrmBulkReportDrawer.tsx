import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, RefreshCw, Download, ExternalLink, AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  getCrmCampaign,
  retryCrmCampaignFailed,
  retryCrmCampaignSkipped,
  type BulkBreakdownRow,
} from "@/lib/crm-bulk.functions";
import { classifySmsFailure, classifyEmailFailure, humanizeReason } from "@/lib/crm-bulk-report";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type Channel = "sms" | "email";

type Row = {
  id?: string;
  user_id: string | null;
  name: string | null;
  contact: string | null;
  status: string;
  provider_code: number | null;
  error_reason: string | null;
  attempt_no?: number;
  created_at?: string;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
};


export function CrmBulkReportDrawer({
  campaignId,
  initial,
  onClose,
}: {
  campaignId: string;
  initial?: {
    channel: Channel;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    breakdown: BulkBreakdownRow[];
  };
  onClose: () => void;
}) {
  useScrollLock(true);
  const load = useServerFn(getCrmCampaign);
  const retryFailed = useServerFn(retryCrmCampaignFailed);
  const retrySkipped = useServerFn(retryCrmCampaignSkipped);

  const [rows, setRows] = useState<Row[]>(
    initial?.breakdown.map((b) => ({
      user_id: b.user_id,
      name: b.name,
      contact: b.contact,
      status: b.status,
      provider_code: b.provider_code,
      error_reason: b.error_reason,
    })) ?? [],
  );
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "sms");
  const [summary, setSummary] = useState({
    sent: initial?.sent ?? 0,
    failed: initial?.failed ?? 0,
    skipped: initial?.skipped ?? 0,
    total: initial?.total ?? 0,
  });
  const [tab, setTab] = useState<"all" | "sent" | "failed" | "skipped">("all");
  const [loading, setLoading] = useState(!initial);
  const [retrying, setRetrying] = useState<"failed" | "skipped" | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res: any = await load({ data: { id: campaignId } });
      setChannel(res.channel);
      setRows(res.rows);
      const c = res.campaign;
      setSummary({
        sent: c.sent ?? 0,
        failed: c.failed ?? 0,
        skipped: c.skipped_no_contact ?? 0,
        total: c.total ?? 0,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initial) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Buckets
  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "sent") return r.status === "sent" || r.status === "delivered" || r.status === "opened" || r.status === "clicked";
    if (tab === "failed") return r.status === "failed" || r.status === "bounced";
    if (tab === "skipped") return r.status === "skipped";
    return true;
  });

  const retryableCount = rows.filter((r) => {
    if (r.status !== "failed" && r.status !== "bounced") return false;
    const cls = channel === "sms" ? classifySmsFailure(r.provider_code, r.error_reason) : classifyEmailFailure(r.error_reason);
    return cls !== "permanent";
  }).length;
  const skippedWithUser = rows.filter((r) => r.status === "skipped" && r.user_id).length;

  async function handleRetryFailed() {
    if (!retryableCount) return;
    setRetrying("failed");
    try {
      const res: any = await retryFailed({ data: { id: campaignId } });
      toast.success(`Retry: ${res.sent} sent · ${res.failed} failed`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  async function handleRetrySkipped() {
    if (!skippedWithUser) return;
    setRetrying("skipped");
    try {
      const res: any = await retrySkipped({ data: { id: campaignId } });
      toast.success(`Retry: ${res.sent} sent · ${res.failed} failed · ${res.skipped} still skipped`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  function exportCsv() {
    const header = ["Name", "Contact", "Status", "Reason"];
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          [
            JSON.stringify(r.name ?? ""),
            JSON.stringify(r.contact ?? ""),
            r.status,
            JSON.stringify(humanizeReason(channel, r.status, r.provider_code, r.error_reason)),
          ].join(","),
        ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-${campaignId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const balanceIssue = rows.some((r) => r.provider_code === 1007);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-semibold">
              Bulk {channel === "sms" ? "SMS" : "Email"} report
            </h2>
            <p className="text-xs text-muted-foreground">Campaign {campaignId.slice(0, 8)}…</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} disabled={loading} className="rounded-md p-1 hover:bg-muted" title="Refresh">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCsv} className="rounded-md p-1 hover:bg-muted" title="Export CSV">
              <Download className="size-4" />
            </button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2 border-b border-border bg-muted/30 px-5 py-3 text-center text-sm">
          <Stat label="Total" value={summary.total} tone="neutral" />
          <Stat label="Sent" value={summary.sent} tone="ok" />
          <Stat label="Failed" value={summary.failed} tone="err" />
          <Stat label="Skipped" value={summary.skipped} tone="warn" />
        </div>

        {balanceIssue && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4" />
            <div>
              <strong>SMS gateway balance was insufficient during this send.</strong> Recharge bulksmsbd, then click "Retry failed" to resend affected rows.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <button
            onClick={handleRetryFailed}
            disabled={!retryableCount || retrying !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {retrying === "failed" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Retry failed ({retryableCount})
          </button>
          <button
            onClick={handleRetrySkipped}
            disabled={!skippedWithUser || retrying !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            title="Send to skipped recipients that now have contact info"
          >
            {retrying === "skipped" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Retry skipped ({skippedWithUser})
          </button>
          <span className="ml-auto text-xs text-muted-foreground">
            "Retry failed" only includes retryable errors (gateway, balance, timeout). Permanent errors (invalid number, bounced) require fixing the customer record.
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {(["all", "sent", "failed", "skipped"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-sm capitalize ${tab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No rows in this tab.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Recipient</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id ?? `${r.contact}-${i}`} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.contact ?? <span className="italic">no contact</span>}</div>
                    </td>
                    <td className="px-4 py-2">
                      <StatusChip status={r.status} />
                      <EventTimeline row={r} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {humanizeReason(channel, r.status, r.provider_code, r.error_reason)}
                      {r.attempt_no && r.attempt_no > 1 ? (
                        <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">attempt {r.attempt_no}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.user_id ? (
                        <Link to="/workspace/crm/$id" params={{ id: r.user_id }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Open <ExternalLink className="size-3" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "neutral" | "ok" | "err" | "warn" }) {
  const cls =
    tone === "ok" ? "text-emerald-600" :
    tone === "err" ? "text-destructive" :
    tone === "warn" ? "text-amber-600" :
    "text-foreground";
  return (
    <div>
      <div className={`text-lg font-semibold ${cls}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "sent" || status === "delivered" || status === "opened" || status === "clicked") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="size-3" />{status}</span>;
  }
  if (status === "failed" || status === "bounced") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><XCircle className="size-3" />{status}</span>;
  }
  if (status === "skipped") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><MinusCircle className="size-3" />skipped</span>;
  }
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{status}</span>;
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EventTimeline({ row }: { row: Row }) {
  const events: Array<{ label: string; at: string }> = [];
  const d = fmtTime(row.delivered_at);
  const o = fmtTime(row.opened_at);
  const c = fmtTime(row.clicked_at);
  const b = fmtTime(row.bounced_at);
  if (d) events.push({ label: "delivered", at: d });
  if (o) events.push({ label: "opened", at: o });
  if (c) events.push({ label: "clicked", at: c });
  if (b) events.push({ label: "bounced", at: b });
  if (!events.length) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
      {events.map((e) => (
        <div key={e.label}>· {e.label} {e.at}</div>
      ))}
    </div>
  );
}

