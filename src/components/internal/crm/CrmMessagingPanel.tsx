import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, MessageSquare, Mail as MailIcon } from "lucide-react";
import { toast } from "sonner";
import {
  sendCrmSms,
  sendCrmEmail,
  resendCrmEmail,
  listCrmDeliveries,
  previewTemplate,
  type CrmSmsDelivery,
  type CrmEmailDelivery,
  type CrmVars,
} from "@/lib/crm-messaging.functions";
import { listSmsTemplates } from "@/lib/sms.functions";
import { listEmailTemplates } from "@/lib/email-templates.functions";
import { SmsStatusChip } from "@/components/internal/SmsStatusChip";

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmailStatusChips({ d }: { d: CrmEmailDelivery }) {
  const chips: { label: string; tone: string; when: string | null }[] = [];
  chips.push({
    label: d.status,
    tone: chipTone(d.status),
    when: d.sent_at ?? d.created_at,
  });
  if (d.delivered_at) chips.push({ label: "delivered", tone: "bg-emerald-500/10 text-emerald-700", when: d.delivered_at });
  if (d.opened_at) chips.push({ label: "opened", tone: "bg-sky-500/10 text-sky-700", when: d.opened_at });
  if (d.clicked_at) chips.push({ label: "clicked", tone: "bg-indigo-500/10 text-indigo-700", when: d.clicked_at });
  if (d.bounced_at) chips.push({ label: `bounced${d.bounce_type ? ` · ${d.bounce_type}` : ""}`, tone: "bg-rose-500/10 text-rose-700", when: d.bounced_at });
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.tone}`} title={c.when ? fmtWhen(c.when) : undefined}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function chipTone(status: string): string {
  switch (status) {
    case "sent": return "bg-slate-500/10 text-slate-700";
    case "delivered": return "bg-emerald-500/10 text-emerald-700";
    case "opened": return "bg-sky-500/10 text-sky-700";
    case "clicked": return "bg-indigo-500/10 text-indigo-700";
    case "bounced": return "bg-rose-500/10 text-rose-700";
    case "failed": return "bg-red-500/15 text-red-700";
    case "delayed": return "bg-amber-500/10 text-amber-700";
    case "queued":
    case "scheduled":
    default: return "bg-muted text-muted-foreground";
  }
}

function insertAtCursor(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  setValue: (v: string) => void,
  token: string,
) {
  if (!el) {
    setValue(value + token);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    try { el.setSelectionRange(pos, pos); } catch {}
  });
}

function VarChips({ vars, onPick }: { vars: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {vars.map((v) => (
        <button
          type="button"
          key={v}
          onClick={() => onPick(v)}
          className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary"
          title={`Insert {{${v}}}`}
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}


type Props = {
  vars: CrmVars;
  userId: string | null;
  phone: string | null;
  email: string | null;
};

export function CrmMessagingPanel({ vars, userId, phone, email }: Props) {
  const sendSmsFn = useServerFn(sendCrmSms);
  const sendEmailFn = useServerFn(sendCrmEmail);
  const resendFn = useServerFn(resendCrmEmail);
  const listFn = useServerFn(listCrmDeliveries);
  const listSmsTplFn = useServerFn(listSmsTemplates);
  const listEmailTplFn = useServerFn(listEmailTemplates);

  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [smsBody, setSmsBody] = useState("");
  const [smsTplId, setSmsTplId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailTplId, setEmailTplId] = useState<string | null>(null);
  const [sending, setSending] = useState<"sms" | "email" | null>(null);
  const [history, setHistory] = useState<{ sms: CrmSmsDelivery[]; emails: CrmEmailDelivery[] }>({ sms: [], emails: [] });
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const isManual = (t: any) => {
      const cat = String(t?.category ?? "other").toLowerCase();
      return cat !== "transactional" && cat !== "otp";
    };
    listSmsTplFn().then((r: any) => setSmsTemplates((r?.templates ?? []).filter(isManual))).catch(() => {});
    listEmailTplFn().then((r: any) => setEmailTemplates((r?.templates ?? []).filter(isManual))).catch(() => {});
    refresh();
  }, [userId, phone, email]);

  async function refresh() {
    setHistoryLoading(true);
    try {
      const r = await listFn({
        data: {
          user_id: userId ?? null,
          phone: !userId ? phone : null,
          email: !userId ? email : null,
        },
      });
      setHistory(r as any);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  function applySmsTemplate(id: string) {
    setSmsTplId(id);
    const tpl = smsTemplates.find((t) => t.id === id);
    if (tpl) setSmsBody(previewTemplate(tpl.body ?? "", vars));
  }
  function applyEmailTemplate(id: string) {
    setEmailTplId(id);
    const tpl = emailTemplates.find((t) => t.id === id);
    if (tpl) {
      setEmailSubject(previewTemplate(tpl.subject ?? "", vars));
      setEmailBody(previewTemplate(tpl.body_html ?? "", vars));
    }
  }

  async function handleSendSms() {
    if (!phone) return toast.error("No phone number for this contact");
    if (!smsBody.trim()) return toast.error("SMS body is empty");
    setSending("sms");
    try {
      await sendSmsFn({
        data: {
          user_id: userId ?? null,
          to_phone: phone,
          body: smsBody.trim(),
          template_id: smsTplId ?? null,
        },
      });
      toast.success("SMS sent");
      setSmsBody("");
      setSmsTplId(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send SMS");
    } finally {
      setSending(null);
    }
  }

  async function handleSendEmail() {
    if (!email) return toast.error("No email address for this contact");
    if (!emailSubject.trim() || !emailBody.trim()) return toast.error("Subject and body required");
    setSending("email");
    try {
      await sendEmailFn({
        data: {
          user_id: userId ?? null,
          to_email: email,
          subject: emailSubject.trim(),
          body_html: emailBody,
          template_id: emailTplId ?? null,
        },
      });
      toast.success("Email sent");
      setEmailSubject("");
      setEmailBody("");
      setEmailTplId(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send email");
    } finally {
      setSending(null);
    }
  }

  async function handleResend(id: string) {
    try {
      await resendFn({ data: { delivery_id: id } });
      toast.success("Email resent");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to resend");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* SMS */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <MessageSquare className="size-4 text-primary" />
          <h3 className="font-semibold">SMS</h3>
          <span className="ml-auto text-xs text-muted-foreground">{phone ?? "no phone"}</span>
        </header>
        <div className="space-y-3 p-4">
          <select
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={smsTplId ?? ""}
            onChange={(e) => e.target.value ? applySmsTemplate(e.target.value) : setSmsTplId(null)}
          >
            <option value="">— Pick template or type below —</option>
            {smsTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Type or select a template. Variables like {{name}} {{phone}} auto-fill on preview."
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{smsBody.length} chars</span>
            <button
              onClick={handleSendSms}
              disabled={!phone || sending === "sms"}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {sending === "sms" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Send SMS
            </button>
          </div>
        </div>
      </section>

      {/* Email */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          <MailIcon className="size-4 text-primary" />
          <h3 className="font-semibold">Email</h3>
          <span className="ml-auto text-xs text-muted-foreground">{email ?? "no email"}</span>
        </header>
        <div className="space-y-3 p-4">
          <select
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={emailTplId ?? ""}
            onChange={(e) => e.target.value ? applyEmailTemplate(e.target.value) : setEmailTplId(null)}
          >
            <option value="">— Pick template or compose below —</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />
          <textarea
            className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            placeholder="HTML body. Use {{name}}, {{email}}, {{phone}}, {{last_order_no}}, {{ltv}}."
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSendEmail}
              disabled={!email || sending === "email"}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {sending === "email" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Send Email
            </button>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-border bg-card lg:col-span-2">
        <header className="border-b border-border px-5 py-3">
          <h3 className="font-semibold">Delivery history</h3>
        </header>
        {historyLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.emails.length === 0 && history.sms.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No messages yet.</div>
            )}
            {history.emails.map((d) => (
              <div key={`e-${d.id}`} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <MailIcon className="size-3.5 text-muted-foreground" />
                    <span className="truncate font-medium">{d.subject}</span>
                    {d.attempt_no > 1 && <span className="text-[10px] text-muted-foreground">·  attempt #{d.attempt_no}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    To {d.to_email} · {fmtWhen(d.created_at)}
                    {d.error_reason && <span className="ml-2 text-rose-600">· {d.error_reason}</span>}
                  </div>
                  <div className="mt-1.5"><EmailStatusChips d={d} /></div>
                </div>
                <button
                  onClick={() => handleResend(d.id)}
                  className="shrink-0 rounded-md border border-input px-2 py-1 text-[11px] hover:bg-accent"
                >
                  Resend
                </button>
              </div>
            ))}
            {history.sms.map((d) => (
              <div key={`s-${d.id}`} className="flex flex-col gap-1.5 px-5 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  <SmsStatusChip status={d.status} providerStatus={d.provider_status} errorReason={d.error_reason} />
                  <span className="text-xs text-muted-foreground">{d.to_phone} · {d.sms_count ?? 1} SMS{d.is_unicode ? " (Unicode)" : ""}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtWhen(d.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-xs text-foreground/80">{d.body}</p>
                {d.error_reason && <p className="text-xs text-rose-600">{d.error_reason}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
