import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { listCrmCampaigns } from "@/lib/crm-bulk.functions";
import { CrmBulkReportDrawer } from "./CrmBulkReportDrawer";

type Row = {
  id: string;
  channel: "sms" | "email";
  subject: string | null;
  body: string;
  sender_user_id: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped_no_contact: number;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CrmCampaignsPanel() {
  const list = useServerFn(listCrmCampaigns);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    list({ data: { limit: 100 } })
      .then((r: any) => setRows(r as Row[]))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [openId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Bulk campaigns</h1>
        <p className="text-sm text-muted-foreground">History of every bulk SMS/email send — click a row to inspect deliveries, failures, and retry.</p>
      </header>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No campaigns yet. Bulk sends from the CRM list will show here.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Sent at</th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Preview</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-border hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                      {r.channel === "sms" ? <MessageSquare className="size-3" /> : <Mail className="size-3" />}
                      {r.channel}
                    </span>
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-muted-foreground">
                    {r.channel === "email" && r.subject ? <span className="font-medium text-foreground">{r.subject}</span> : null}{" "}
                    {r.body.slice(0, 80)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{r.total}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{r.sent}</td>
                  <td className="px-4 py-3 text-right text-destructive">{r.failed}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{r.skipped_no_contact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openId && <CrmBulkReportDrawer campaignId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
