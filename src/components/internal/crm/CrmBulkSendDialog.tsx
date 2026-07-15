import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { sendCrmBulkSms, sendCrmBulkEmail } from "@/lib/crm-bulk.functions";
import { listSmsTemplates } from "@/lib/sms.functions";
import { listEmailTemplates } from "@/lib/email-templates.functions";

export type BulkRecipient = {
  user_id?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  last_order_no?: string | null;
  ltv?: number | null;
};

type Channel = "sms" | "email";

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

  const [templates, setTemplates] = useState<any[]>([]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);

  const eligible = recipients.filter((r) =>
    channel === "sms" ? !!r.phone : !!r.email,
  );

  useEffect(() => {
    if (channel === "sms") {
      listSms().then((r: any) => setTemplates(r?.templates ?? [])).catch(() => {});
    } else {
      listEmail().then((r: any) => setTemplates(r?.templates ?? [])).catch(() => {});
    }
  }, [channel]);

  function applyTemplate(id: string) {
    setTplId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (channel === "sms") setBody(tpl.body ?? "");
    else {
      setSubject(tpl.subject ?? "");
      setBody(tpl.body_html ?? "");
    }
  }

  async function handleSend() {
    if (!eligible.length) return toast.error(`No recipients with ${channel === "sms" ? "phone" : "email"}`);
    if (!body.trim()) return toast.error("Body is empty");
    if (channel === "email" && !subject.trim()) return toast.error("Subject required");
    setSending(true);
    try {
      if (channel === "sms") {
        const res = await sendSms({
          data: {
            recipients: eligible
              .filter((r) => r.phone)
              .map((r) => ({
                user_id: r.user_id ?? null,
                phone: r.phone!,
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
        toast.success(`SMS: ${res.sent} sent · ${res.failed} failed`);
      } else {
        const res = await sendEmail({
          data: {
            recipients: eligible
              .filter((r) => r.email)
              .map((r) => ({
                user_id: r.user_id ?? null,
                email: r.email!,
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
        toast.success(`Email: ${res.sent} sent · ${res.failed} failed`);
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-semibold">
              Bulk {channel === "sms" ? "SMS" : "Email"} — {eligible.length} recipient
              {eligible.length === 1 ? "" : "s"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {recipients.length - eligible.length > 0 &&
                `${recipients.length - eligible.length} skipped (no ${channel === "sms" ? "phone" : "email"}) · `}
              Vars: {"{{name}}"}, {"{{last_order_no}}"}, {"{{ltv}}"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-3 p-5">
          {templates.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select
                value={tplId ?? ""}
                onChange={(e) => e.target.value && applyTemplate(e.target.value)}
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
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {channel === "sms" ? "Message" : "Body (HTML)"}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === "sms" ? 5 : 10}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
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
            disabled={sending || !eligible.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send to {eligible.length}
          </button>
        </footer>
      </div>
    </div>
  );
}
