import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Mail, RefreshCw, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResendEventChips, ResendLogo } from "@/components/internal/ResendEventChips";
import {
  listInternalEmailDeliveries,
  listInternalSmsDeliveries,
} from "@/lib/admin-users.functions";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type EmailRow = {
  id: string;
  kind: string;
  to_email: string;
  subject: string | null;
  status: string | null;
  resend_email_id: string | null;
  error_reason: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
  updated_at: string | null;
};

type SmsRow = {
  id: string;
  kind: string;
  to_phone: string;
  body: string;
  status: string | null;
  sms_count: number | null;
  is_unicode: boolean | null;
  provider_status: number | null;
  error_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

type Tab = "all" | "email" | "sms";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function InternalEmailLogsDialog({
  userId,
  userLabel,
  onClose,
}: {
  userId: string;
  userLabel: string;
  onClose: () => void;
}) {
  const listEmails = useServerFn(listInternalEmailDeliveries);
  const listSms = useServerFn(listInternalSmsDeliveries);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [sms, setSms] = useState<SmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  useScrollLock(true);

  async function refresh() {
    try {
      const [e, s] = await Promise.all([
        listEmails({ data: { user_id: userId } }) as Promise<EmailRow[]>,
        listSms({ data: { user_id: userId } }).catch(() => []) as Promise<SmsRow[]>,
      ]);
      setEmails(e ?? []);
      setSms(s ?? []);
    } catch (err) {
      console.error("[InternalEmailLogsDialog] load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`internal-delivery-logs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_email_deliveries",
          filter: `user_id=eq.${userId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_sms_deliveries",
          filter: `user_id=eq.${userId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const showEmail = tab === "all" || tab === "email";
  const showSms = tab === "all" || tab === "sms";
  const isEmpty = !loading && (!showEmail || emails.length === 0) && (!showSms || sms.length === 0);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ResendLogo className="size-5 text-slate-900" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">
                Delivery logs (Email &amp; SMS)
              </h3>
              <p className="truncate text-xs text-slate-500">{userLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Refresh"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5">
          {(["all", "email", "sms"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-indigo-600 text-indigo-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "all" ? `All (${emails.length + sms.length})` : t === "email" ? `Email (${emails.length})` : `SMS (${sms.length})`}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : isEmpty ? (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">
              <Mail className="mx-auto mb-2 size-6 text-slate-400" />
              No deliveries yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {showEmail &&
                emails.map((r) => (
                  <li
                    key={`e-${r.id}`}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                          <Mail className="size-3" /> Email
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {r.subject || "(no subject)"}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          To: {r.to_email} ·{" "}
                          <span className="font-mono uppercase tracking-wider text-[10px]">
                            {r.kind}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-medium text-slate-400">
                        {fmt(r.created_at)}
                      </div>
                    </div>

                    <ResendEventChips
                      events={{
                        status: r.status,
                        sent_at: r.sent_at,
                        delivered_at: r.delivered_at,
                        opened_at: r.opened_at,
                        clicked_at: r.clicked_at,
                        bounced_at: r.bounced_at,
                        error_reason: r.error_reason,
                        updated_at: r.updated_at,
                      }}
                    />

                    {r.error_reason && (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700">
                        {r.error_reason}
                      </div>
                    )}
                  </li>
                ))}

              {showSms &&
                sms.map((r) => (
                  <li
                    key={`s-${r.id}`}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          <MessageSquare className="size-3" /> SMS
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          To: {r.to_phone} ·{" "}
                          <span className="font-mono uppercase tracking-wider text-[10px]">
                            {r.kind}
                          </span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                          {r.body}
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-medium text-slate-400">
                        {fmt(r.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          r.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "failed"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status ?? "—"}
                      </span>
                      {typeof r.sms_count === "number" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          {r.sms_count} SMS
                        </span>
                      )}
                      {r.is_unicode && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          Unicode
                        </span>
                      )}
                    </div>

                    {r.error_reason && (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700">
                        {r.error_reason}
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-[11px] text-slate-500">
          Live-updated — email statuses via Resend webhook, SMS via Bulksmsbd send response.
        </div>
      </div>
    </div>
  );
}
