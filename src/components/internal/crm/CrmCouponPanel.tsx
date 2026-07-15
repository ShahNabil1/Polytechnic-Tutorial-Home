import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Ticket, Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  createCrmCustomerCoupon,
  listCrmCustomerCoupons,
} from "@/lib/crm-bulk.functions";

type Coupon = {
  id: string;
  code: string;
  name: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_spend: number;
  ends_at: string | null;
  is_active: boolean;
  uses_count: number;
  max_uses_per_customer: number | null;
  created_at: string;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function randomCode(prefix = "GIFT") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function CrmCouponPanel({
  userId,
  name,
  phone,
  email,
}: {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}) {
  const listFn = useServerFn(listCrmCustomerCoupons);
  const createFn = useServerFn(createCrmCustomerCoupon);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState(randomCode());
  const [couponName, setCouponName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [minSpend, setMinSpend] = useState("0");
  const [endsAt, setEndsAt] = useState("");
  const [notifySms, setNotifySms] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);

  useEffect(() => {
    refresh();
  }, [userId]);

  async function refresh() {
    setLoading(true);
    try {
      const r = await listFn({ data: { user_id: userId } });
      setCoupons(r as Coupon[]);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const dv = Number(discountValue);
    if (!code.trim() || !couponName.trim() || !dv) {
      toast.error("Code, name, and discount value are required");
      return;
    }
    setCreating(true);
    try {
      const res: any = await createFn({
        data: {
          user_id: userId,
          code: code.trim(),
          name: couponName.trim(),
          discount_type: discountType,
          discount_value: dv,
          min_spend: Number(minSpend) || 0,
          max_uses_per_customer: 1,
          ends_at: endsAt || null,
          scope: "shop",
          notify_sms: notifySms && !!phone,
          notify_email: notifyEmail && !!email,
          notify_phone: phone,
          notify_email_addr: email,
          notify_name: name,
        },
      });
      toast.success(`Coupon ${res.code} created`);
      if (res.smsResult && !res.smsResult.ok) toast.error(`SMS failed: ${res.smsResult.error}`);
      if (res.emailResult && !res.emailResult.ok) toast.error(`Email failed: ${res.emailResult.error}`);
      setShowForm(false);
      setCode(randomCode());
      setCouponName("");
      setDiscountValue("10");
      setMinSpend("0");
      setEndsAt("");
      setNotifySms(false);
      setNotifyEmail(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create coupon");
    } finally {
      setCreating(false);
    }
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    setCopied(c);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Ticket className="size-4" /> Personal coupons
          </h2>
          <p className="text-xs text-muted-foreground">
            Customer-scoped codes. Only this customer can redeem them.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> New coupon
        </button>
      </header>

      {showForm && (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
          <Field label="Code">
            <div className="flex gap-1">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setCode(randomCode())}
                className="rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
              >
                ⟳
              </button>
            </div>
          </Field>
          <Field label="Internal name">
            <input
              value={couponName}
              onChange={(e) => setCouponName(e.target.value)}
              placeholder="e.g. Loyalty gift for X"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Discount type">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="percent">Percent %</option>
              <option value="flat">Flat ৳</option>
            </select>
          </Field>
          <Field label={discountType === "percent" ? "Value (%)" : "Value (৳)"}>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Min spend (৳)">
            <input
              type="number"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Expires at (optional)">
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                disabled={!phone}
              />
              Send SMS notification{!phone && " (no phone)"}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                disabled={!email}
              />
              Send email notification{!email && " (no email)"}
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              Create coupon
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto size-4 animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No personal coupons yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                onClick={() => copyCode(c.code)}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold text-primary hover:bg-primary/20"
              >
                {copied === c.code ? <Check className="size-3" /> : <Copy className="size-3" />}
                {c.code}
              </button>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.discount_type === "percent" ? `${c.discount_value}% off` : `৳${c.discount_value} off`}
                  {c.min_spend > 0 && ` · min ৳${c.min_spend}`}
                  {c.ends_at && ` · expires ${fmtDate(c.ends_at)}`}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  !c.is_active
                    ? "bg-slate-200 text-slate-600"
                    : c.uses_count > 0
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-sky-500/10 text-sky-700"
                }`}
              >
                {!c.is_active ? "Inactive" : c.uses_count > 0 ? `Used ${c.uses_count}×` : "Unused"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
