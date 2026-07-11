import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, RotateCcw, Ticket, Search, Check, X } from "lucide-react";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listCoupons,
  upsertCoupon,
  toggleCoupon,
  softDeleteCoupon,
  reactivateCoupon,
  listProductsForCoupon,
  listCategoriesForCoupon,
  type CouponRow,
  type CouponScope,
  type CouponAppliesTo,
  type CouponDiscountType,
} from "@/lib/coupons.functions";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const SCOPES: { key: CouponScope; label: string; hint: string; disabled?: boolean }[] = [
  { key: "shop", label: "Shop Coupons", hint: "For physical books, bundles & e-books." },
  { key: "course", label: "Course Coupons", hint: "For future courses — ready when courses ship." },
  { key: "special", label: "Special Coupons", hint: "Customer-targeted (unlocks after CRM build)." },
];

type Draft = {
  id?: string;
  scope: CouponScope;
  code: string;
  name: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: string;
  cap_amount: string;
  min_spend: string;
  max_uses_total: string;
  max_uses_per_customer: string;
  applies_to: CouponAppliesTo;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  stackable: boolean;
  exclude_shipping: boolean;
  targets: { target_type: "product" | "category" | "course" | "customer"; target_id: string }[];
};

const emptyDraft = (scope: CouponScope): Draft => ({
  scope,
  code: "",
  name: "",
  description: "",
  discount_type: "percent",
  discount_value: "10",
  cap_amount: "",
  min_spend: "0",
  max_uses_total: "",
  max_uses_per_customer: "",
  applies_to: "all",
  starts_at: "",
  ends_at: "",
  is_active: true,
  stackable: false,
  exclude_shipping: true,
  targets: [],
});

export function AdminCouponsManager() {
  const [scope, setScope] = useState<CouponScope>("shop");
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "deleted">("all");
  const [editing, setEditing] = useState<Draft | null>(null);

  const listFn = useServerFn(listCoupons);
  const toggleFn = useServerFn(toggleCoupon);
  const delFn = useServerFn(softDeleteCoupon);
  const reactivateFn = useServerFn(reactivateCoupon);

  async function reload() {
    setLoading(true);
    try {
      const r = await listFn({ data: { scope } });
      setRows(r);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (q && !(`${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()))) return false;
      if (filter === "deleted") return !!r.deleted_at;
      if (r.deleted_at) return false;
      if (filter === "active") {
        if (!r.is_active) return false;
        if (r.ends_at && new Date(r.ends_at).getTime() < now) return false;
        return true;
      }
      if (filter === "inactive") {
        return !r.is_active || (r.ends_at && new Date(r.ends_at).getTime() < now);
      }
      return true;
    });
  }, [rows, q, filter]);

  async function onToggle(row: CouponRow) {
    try {
      await toggleFn({ data: { id: row.id, is_active: !row.is_active } });
      toast.success(row.is_active ? "Deactivated" : "Activated");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Toggle failed");
    }
  }

  async function onDelete(row: CouponRow) {
    const ok = await confirmDialog({
      title: `Delete coupon ${row.code}?`,
      description: "Coupon will be hidden but can be restored later.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await delFn({ data: { id: row.id } });
      toast.success("Deleted");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onReactivate(row: CouponRow) {
    try {
      await reactivateFn({ data: { id: row.id } });
      toast.success("Reactivated");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Reactivate failed");
    }
  }

  function beginEdit(row?: CouponRow) {
    if (!row) return setEditing(emptyDraft(scope));
    setEditing({
      id: row.id,
      scope: row.scope,
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      discount_type: row.discount_type,
      discount_value: String(row.discount_value),
      cap_amount: row.cap_amount != null ? String(row.cap_amount) : "",
      min_spend: String(row.min_spend ?? 0),
      max_uses_total: row.max_uses_total != null ? String(row.max_uses_total) : "",
      max_uses_per_customer: row.max_uses_per_customer != null ? String(row.max_uses_per_customer) : "",
      applies_to: row.applies_to,
      starts_at: row.starts_at ? row.starts_at.slice(0, 16) : "",
      ends_at: row.ends_at ? row.ends_at.slice(0, 16) : "",
      is_active: row.is_active,
      stackable: row.stackable,
      exclude_shipping: row.exclude_shipping,
      targets: row.targets ?? [],
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
            <Ticket className="size-5 text-brand" /> Coupons
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, target and manage promo codes across Shop, Courses and CRM-driven Special campaigns.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          onClick={() => beginEdit()}
        >
          <Plus className="size-4" /> New Coupon
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-1">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-xs md:text-sm",
              scope === s.key ? "bg-brand text-brand-foreground font-bold" : "hover:bg-accent",
            )}
          >
            <div className="font-semibold">{s.label}</div>
            <div className={cn("text-[10.5px] md:text-[11px] mt-0.5", scope === s.key ? "opacity-90" : "text-muted-foreground")}>{s.hint}</div>
          </button>
        ))}
      </div>

      {scope === "special" && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Special coupons can be created but customer-targeting will activate once the CRM ships. Set <b>Applies to → Specific customers</b> then add customer IDs.
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-8"
            placeholder="Search code or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {(["all", "active", "inactive", "deleted"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize",
              filter === k ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-accent",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Discount</th>
              <th className="p-3 text-left">Applies to</th>
              <th className="p-3 text-left">Uses</th>
              <th className="p-3 text-left">Validity</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No coupons yet. Click <b>New Coupon</b> to create one.</td></tr>
            )}
            {!loading && filtered.map((r) => {
              const expired = r.ends_at && new Date(r.ends_at).getTime() < Date.now();
              const statusLabel = r.deleted_at ? "Deleted" : expired ? "Expired" : r.is_active ? "Active" : "Inactive";
              const statusCls = r.deleted_at
                ? "bg-red-100 text-red-700"
                : expired
                  ? "bg-amber-100 text-amber-800"
                  : r.is_active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600";
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-mono text-sm font-bold">{r.code}</div>
                    <div className="text-xs text-muted-foreground">{r.name}</div>
                  </td>
                  <td className="p-3">
                    {r.discount_type === "percent"
                      ? <>{r.discount_value}%{r.cap_amount ? ` (max ${formatBDT(r.cap_amount)})` : ""}</>
                      : <>{formatBDT(r.discount_value)} off</>}
                    {r.min_spend > 0 && (
                      <div className="text-[11px] text-muted-foreground">Min spend {formatBDT(r.min_spend)}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {r.applies_to === "all" ? "All products" : `${r.applies_to} (${r.targets.length})`}
                  </td>
                  <td className="p-3 text-xs">
                    {r.uses_count}{r.max_uses_total ? ` / ${r.max_uses_total}` : ""}
                    {r.max_uses_per_customer ? <div className="text-[11px] text-muted-foreground">{r.max_uses_per_customer}/customer</div> : null}
                  </td>
                  <td className="p-3 text-xs">
                    {r.starts_at || r.ends_at ? (
                      <>
                        <div>{r.starts_at ? new Date(r.starts_at).toLocaleDateString() : "—"}</div>
                        <div className="text-muted-foreground">→ {r.ends_at ? new Date(r.ends_at).toLocaleDateString() : "∞"}</div>
                      </>
                    ) : "No limit"}
                  </td>
                  <td className="p-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", statusCls)}>{statusLabel}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      {!r.deleted_at && (
                        <>
                          <button title={r.is_active ? "Deactivate" : "Activate"} onClick={() => onToggle(r)} className="rounded p-1.5 hover:bg-accent">
                            {r.is_active ? <X className="size-4" /> : <Check className="size-4" />}
                          </button>
                          <button title="Edit" onClick={() => beginEdit(r)} className="rounded p-1.5 hover:bg-accent">
                            <Pencil className="size-4" />
                          </button>
                          <button title="Delete" onClick={() => onDelete(r)} className="rounded p-1.5 hover:bg-accent text-destructive">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                      {r.deleted_at && (
                        <button title="Reactivate" onClick={() => onReactivate(r)} className="rounded p-1.5 hover:bg-accent text-emerald-700">
                          <RotateCcw className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <CouponFormDialog
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

// -------- Form Dialog --------
function CouponFormDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string; kind: string }[]>([]);
  const upsertFn = useServerFn(upsertCoupon);
  const prodFn = useServerFn(listProductsForCoupon);
  const catsFn = useServerFn(listCategoriesForCoupon);

  useEffect(() => {
    if (d.applies_to === "products" && products.length === 0) {
      prodFn().then(setProducts).catch(() => {});
    }
    if (d.applies_to === "categories" && cats.length === 0) {
      catsFn().then(setCats).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.applies_to]);

  function update<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  function toggleTarget(type: "product" | "category" | "course" | "customer", id: string) {
    setD((prev) => {
      const has = prev.targets.some((t) => t.target_type === type && t.target_id === id);
      return {
        ...prev,
        targets: has
          ? prev.targets.filter((t) => !(t.target_type === type && t.target_id === id))
          : [...prev.targets, { target_type: type, target_id: id }],
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: d.id ?? undefined,
        scope: d.scope,
        code: d.code.trim(),
        name: d.name.trim(),
        description: d.description || null,
        discount_type: d.discount_type,
        discount_value: Number(d.discount_value),
        cap_amount: d.cap_amount ? Number(d.cap_amount) : null,
        min_spend: d.min_spend ? Number(d.min_spend) : 0,
        max_uses_total: d.max_uses_total ? Number(d.max_uses_total) : null,
        max_uses_per_customer: d.max_uses_per_customer ? Number(d.max_uses_per_customer) : null,
        applies_to: d.applies_to,
        starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
        ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
        is_active: d.is_active,
        stackable: d.stackable,
        exclude_shipping: d.exclude_shipping,
        targets: d.applies_to === "all" ? [] : d.targets,
      };
      await upsertFn({ data: payload });
      toast.success(d.id ? "Coupon updated" : "Coupon created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const targetHelpers = {
    products,
    categories: cats,
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3">
      <form
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{d.id ? "Edit coupon" : "New coupon"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="size-5" /></button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Code" required>
            <input className="input font-mono uppercase" value={d.code} onChange={(e) => update("code", e.target.value.toUpperCase())} maxLength={40} required />
          </Field>
          <Field label="Name" required>
            <input className="input" value={d.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <textarea className="input" rows={2} value={d.description} onChange={(e) => update("description", e.target.value)} />
          </Field>

          <Field label="Discount type" required>
            <select className="input" value={d.discount_type} onChange={(e) => update("discount_type", e.target.value as CouponDiscountType)}>
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat amount (৳)</option>
            </select>
          </Field>
          <Field label={d.discount_type === "percent" ? "Percentage" : "Flat amount"} required>
            <input className="input" type="number" min="0" step="0.01" value={d.discount_value} onChange={(e) => update("discount_value", e.target.value)} required />
          </Field>

          {d.discount_type === "percent" && (
            <Field label="Cap (max discount ৳)" hint="e.g. 20% up to ৳100">
              <input className="input" type="number" min="0" step="0.01" value={d.cap_amount} onChange={(e) => update("cap_amount", e.target.value)} placeholder="Leave empty for no cap" />
            </Field>
          )}
          <Field label="Minimum spend (৳)">
            <input className="input" type="number" min="0" step="0.01" value={d.min_spend} onChange={(e) => update("min_spend", e.target.value)} />
          </Field>

          <Field label="Max total uses" hint="Blank = unlimited">
            <input className="input" type="number" min="1" step="1" value={d.max_uses_total} onChange={(e) => update("max_uses_total", e.target.value)} />
          </Field>
          <Field label="Max uses per customer" hint="Blank = unlimited">
            <input className="input" type="number" min="1" step="1" value={d.max_uses_per_customer} onChange={(e) => update("max_uses_per_customer", e.target.value)} />
          </Field>

          <Field label="Valid from">
            <input className="input" type="datetime-local" value={d.starts_at} onChange={(e) => update("starts_at", e.target.value)} />
          </Field>
          <Field label="Valid until">
            <input className="input" type="datetime-local" value={d.ends_at} onChange={(e) => update("ends_at", e.target.value)} />
          </Field>

          <Field label="Applies to" className="md:col-span-2">
            <select className="input" value={d.applies_to} onChange={(e) => update("applies_to", e.target.value as CouponAppliesTo)}>
              <option value="all">All products in this scope</option>
              {d.scope === "shop" && <option value="products">Specific products</option>}
              {d.scope === "shop" && <option value="categories">Specific categories</option>}
              {d.scope === "course" && <option value="courses">Specific courses (coming soon)</option>}
              {d.scope === "special" && <option value="customers">Specific customers (CRM)</option>}
            </select>
          </Field>

          {d.applies_to === "products" && (
            <TargetPicker
              label="Select products"
              items={targetHelpers.products.map((p) => ({ id: p.id, name: p.title }))}
              selected={d.targets.filter((t) => t.target_type === "product").map((t) => t.target_id)}
              onToggle={(id) => toggleTarget("product", id)}
            />
          )}
          {d.applies_to === "categories" && (
            <TargetPicker
              label="Select categories"
              items={targetHelpers.categories.map((c) => ({ id: c.id, name: `${c.name} (${c.kind})` }))}
              selected={d.targets.filter((t) => t.target_type === "category").map((t) => t.target_id)}
              onToggle={(id) => toggleTarget("category", id)}
            />
          )}
          {(d.applies_to === "courses" || d.applies_to === "customers") && (
            <div className="md:col-span-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
              {d.applies_to === "courses"
                ? "Course targeting activates once the Courses module ships."
                : "Customer targeting activates once the CRM ships."} The coupon will save with no targets and can be edited later.
            </div>
          )}

          <div className="md:col-span-2 grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3">
            <Toggle label="Active" checked={d.is_active} onChange={(v) => update("is_active", v)} />
            <Toggle label="Stackable" checked={d.stackable} onChange={(v) => update("stackable", v)} />
            <Toggle label="Exclude shipping" checked={d.exclude_shipping} onChange={(v) => update("exclude_shipping", v)} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {d.id ? "Save changes" : "Create coupon"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, required, className, children }: { label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-semibold text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-border" />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

function TargetPicker({ label, items, selected, onToggle }: { label: string; items: { id: string; name: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())) : items;
  return (
    <div className="md:col-span-2">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label} ({selected.length} selected)</div>
      <input className="input mb-2" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-card p-2">
        {filtered.length === 0 && <div className="p-3 text-center text-xs text-muted-foreground">No matches</div>}
        {filtered.map((i) => {
          const on = selected.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onToggle(i.id)}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm",
                on ? "bg-brand-soft text-brand font-semibold" : "hover:bg-accent",
              )}
            >
              <span className="truncate">{i.name}</span>
              {on && <Check className="size-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
