import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { sendCrmBulkSms, sendCrmBulkEmail, getGatewayHealth, type BulkBreakdownRow } from "@/lib/crm-bulk.functions";
import { listSmsTemplates } from "@/lib/sms.functions";
import { listEmailTemplates } from "@/lib/email-templates.functions";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { CrmBulkReportDrawer } from "./CrmBulkReportDrawer";

export type BulkRecipient = {
  user_id?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  last_order_no?: string | null;
  ltv?: number | null;
};

type Channel = "sms" | "email";

type ReportState = {
  campaign_id: string;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  breakdown: BulkBreakdownRow[];
  channel: Channel;
};

export function CrmBulkSendDialog({
  channel,
  recipients,
  onClose,
}: {
  channel: Channel;
  recipients: BulkRecipient[];
  onClose: () => void;
}) {
  const sendSms = useServerFn(sendCrmBulkSms);
  const sendEmail = useServerFn(sendCrmBulkEmail);
  const listSms = useServerFn(listSmsTemplates);
  const listEmail = useServerFn(listEmailTemplates);
  const health = useServerFn(getGatewayHealth);

  const [templates, setTemplates] = useState<any[]>([]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [gateway, setGateway] = useState<{ sms: { balance_bdt: number | null; ok: boolean; message: string }; email: { last_24h: number } } | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  useScrollLock(true);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const VARS = channel === "sms"
    ? ["name", "phone", "email", "last_order_no", "ltv"]
    : ["name", "email", "phone", "last_order_no", "ltv"];

  function insertVar(v: string) {
    const token = `{{${v}}}`;
    const active = document.activeElement;
    const targetEl = active === subjectRef.current ? subjectRef.current : bodyRef.current;
    const isSubject = targetEl === subjectRef.current;
    const currentValue = isSubject ? subject : body;
    const setValue = isSubject ? setSubject : setBody;
    if (!targetEl) {
      setValue(currentValue + token);
      return;
    }
    const start = targetEl.selectionStart ?? currentValue.length;
    const end = targetEl.selectionEnd ?? currentValue.length;
    setValue(currentValue.slice(0, start) + token + currentValue.slice(end));
    requestAnimationFrame(() => {
      targetEl.focus();
      const pos = start + token.length;
      try { targetEl.setSelectionRange(pos, pos); } catch { /* noop */ }
    });
  }

  const withContact = recipients.filter((r) => (channel === "sms" ? !!r.phone : !!r.email));
  const missing = recipients.length - withContact.length;

  useEffect(() => {
    const isManual = (t: any) => {
      const cat = String(t?.category ?? "other").toLowerCase();
      return cat !== "transactional" && cat !== "otp";
    };
    if (channel === "sms") {
      listSms().then((r: any) => setTemplates((r?.templates ?? []).filter(isManual))).catch(() => { /* noop */ });
    } else {
      listEmail().then((r: any) => setTemplates((r?.templates ?? []).filter(isManual))).catch(() => { /* noop */ });
    }
    health().then((h: any) => setGateway(h)).catch(() => { /* noop */ });
  }, [channel]);

  function applyTemplate(id: string) {
    if (!id) {
      setTplId(null);
      return;
    }
    setTplId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (channel === "sms") setBody(tpl.body ?? "");
    else {
      setSubject(tpl.subject ?? "");
      setBody(tpl.body_html ?? "");
    }
  }

  // Rough SMS segment estimate for balance warning: 0.35 BDT per segment as a defensive floor;
  // real cost varies by masking/non-masking. Use `sms_count` heuristic: unicode >70 = 2+ segments.
  const estUnicode = /[^\x00-\x7F]/.test(body);
  const estSegments = channel === "sms" && body
    ? Math.max(1, Math.ceil(body.length / (estUnicode ? 67 : 153)))
    : 0;
  const estCost = channel === "sms" ? withContact.length * estSegments * 0.35 : 0;
  const smsBalanceLow = channel === "sms" && gateway?.sms.balance_bdt != null && gateway.sms.balance_bdt < estCost;

  async function handleSend() {
    if (!recipients.length) return toast.error("No recipients selected");
    if (!body.trim()) return toast.error("Body is empty");
    if (channel === "email" && !subject.trim()) return toast.error("Subject required");
    setSending(true);
    try {
      if (channel === "sms") {
        const res: any = await sendSms({
          data: {
            recipients: recipients.map((r) => ({
              user_id: r.user_id ?? null,
              phone: r.phone ?? null,
              vars: {
                name: r.name ?? null,
                email: r.email ?? null,
                last_order_no: r.last_order_no ?? null,
                ltv: r.ltv ?? null,
              },
            })),
            body: body.trim(),
            template_id: tplId,
          },
        });
        toast.success(`SMS: ${res.sent} sent · ${res.failed} failed · ${res.skipped} skipped`);
        setReport({ ...res, channel: "sms" });
      } else {
        const res: any = await sendEmail({
          data: {
            recipients: recipients.map((r) => ({
              user_id: r.user_id ?? null,
              email: r.email ?? null,
              vars: {
                name: r.name ?? null,
                phone: r.phone ?? null,
                last_order_no: r.last_order_no ?? null,
                ltv: r.ltv ?? null,
              },
            })),
            subject: subject.trim(),
            body_html: body,
            template_id: tplId,
          },
        });
        toast.success(`Email: ${res.sent} sent · ${res.failed} failed · ${res.skipped} skipped`);
        setReport({ ...res, channel: "email" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  if (report) {
    return (
      <CrmBulkReportDrawer
        campaignId={report.campaign_id}
        initial={report}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-semibold">
              Bulk {channel === "sms" ? "SMS" : "Email"} — {recipients.length} recipient
              {recipients.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {missing > 0 && (
                <span className="text-amber-600">
                  {missing} without {channel === "sms" ? "phone" : "email"} will be marked skipped ·{" "}
                </span>
              )}
              Vars: {"{{name}}"}, {"{{last_order_no}}"}, {"{{ltv}}"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </header>

        {/* Gateway health */}
        <div className="border-b border-border bg-muted/30 px-5 py-2 text-xs">
          {channel === "sms" ? (
            gateway ? (
              <div className="flex items-center justify-between gap-4">
                <span>
                  SMS gateway balance:{" "}
                  <span className={gateway.sms.balance_bdt != null && gateway.sms.balance_bdt < 100 ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
                    {gateway.sms.balance_bdt != null ? `৳${gateway.sms.balance_bdt.toFixed(2)}` : "unknown"}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Est: {withContact.length} × {estSegments || 1} seg ≈ ৳{estCost.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Checking SMS gateway…</span>
            )
          ) : gateway ? (
            <div>Emails sent (last 24h): <span className="font-semibold text-foreground">{gateway.email.last_24h}</span></div>
          ) : (
            <span className="text-muted-foreground">Checking email usage…</span>
          )}
          {smsBalanceLow && (
            <div className="mt-1 flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 text-destructive">
              <AlertTriangle className="size-3.5" />
              Balance below estimated cost. Recharge bulksmsbd before sending.
            </div>
          )}
        </div>

        <div className="space-y-3 p-5">
          {templates.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select
                value={tplId ?? ""}
                onChange={(e) => applyTemplate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Custom —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? t.title ?? t.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          {channel === "email" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                {channel === "sms" ? "Message" : "Body (HTML)"}
              </label>
              <div className="flex flex-wrap gap-1">
                {VARS.map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => insertVar(v)}
                    className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    title={`Insert {{${v}}}`}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === "sms" ? 5 : 10}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder={channel === "sms" ? "Hi {{name}}, ..." : "<p>Hi {{name}},</p>"}
            />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !recipients.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send to {recipients.length}
          </button>
        </footer>
      </div>
    </div>
  );
}
