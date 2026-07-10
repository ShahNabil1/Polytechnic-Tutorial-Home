import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Phone,
  Mail,
  Save,
  Plus,
  Trash2,
  Copy,
  Send,
  Ban,
  ShieldAlert,
  MessageSquarePlus,
  StickyNote,
  Search,
  User,
  MapPin,
  Fingerprint,
  Globe,
  Package as PackageIcon,
} from "lucide-react";
import {
  getAdminOrder,
  updateOrderCustomer,
  updateOrderItems,
  updateOrderStatus,
  addInternalNote,
  addBlockedIdentifier,
  searchProductsForOrder,
} from "@/lib/orders.functions";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  buildSteadfastPayload,
  formatDhakaDateTime,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AdminOrderDrawer({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const fetchOrder = useServerFn(getAdminOrder);
  const upCustomer = useServerFn(updateOrderCustomer);
  const upItems = useServerFn(updateOrderItems);
  const upStatus = useServerFn(updateOrderStatus);
  const addNote = useServerFn(addInternalNote);
  const addBlock = useServerFn(addBlockedIdentifier);
  const searchProducts = useServerFn(searchProductsForOrder);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => fetchOrder({ data: { id: orderId } }),
  });

  const order = data?.order as Order | null;
  const items = (data?.items ?? []) as OrderItem[];
  const notes = data?.notes ?? [];
  const profile = data?.profile as any;

  const [customer, setCustomer] = useState<any>(null);
  const [itemDraft, setItemDraft] = useState<OrderItem[] | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (order) {
      setCustomer({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        alternative_phone: order.alternative_phone ?? "",
        customer_email: order.customer_email ?? "",
        division: order.division ?? "",
        district: order.district ?? "",
        thana: order.thana ?? "",
        address_line: order.address_line ?? "",
        note: order.note ?? "",
      });
      setItemDraft(items);
    }
  }, [order?.id]);

  const totals = useMemo(() => {
    const list = itemDraft ?? items;
    const subtotal = list.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
    return { subtotal, shipping: Number(order?.shipping_bdt ?? 0), total: subtotal + Number(order?.shipping_bdt ?? 0) };
  }, [itemDraft, items, order?.shipping_bdt]);

  const { data: prodResults } = useQuery({
    queryKey: ["order-product-search", productQuery],
    queryFn: () => searchProducts({ data: { q: productQuery || undefined } }),
    enabled: showSearch,
  });

  async function saveCustomer() {
    try {
      await upCustomer({ data: { id: orderId, patch: customer } });
      toast.success("Customer details updated");
      refetch();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function saveItems() {
    if (!itemDraft) return;
    try {
      await upItems({
        data: {
          id: orderId,
          items: itemDraft.map((i) => ({
            product_id: i.product_id,
            title: i.title,
            sku: i.sku,
            unit_price: Number(i.unit_price),
            quantity: Number(i.quantity),
            image_url: i.image_url || undefined,
            item_type: i.item_type,
          })),
        },
      });
      toast.success("Items updated");
      refetch();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function changeStatus(s: OrderStatus) {
    try {
      await upStatus({ data: { id: orderId, status: s } });
      toast.success(`Marked ${STATUS_LABEL[s]}`);
      refetch();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function submitNote() {
    if (!noteBody.trim()) return;
    try {
      await addNote({ data: { id: orderId, body: noteBody.trim() } });
      setNoteBody("");
      toast.success("Internal note added");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function block(kind: "ip" | "fingerprint" | "phone", value: string) {
    if (!value) return toast.error("No value to block");
    const reason = prompt(`Reason for blocking ${kind} "${value}":`) || undefined;
    try {
      await addBlock({ data: { kind, value, reason } });
      toast.success(`${kind.toUpperCase()} blocked`);
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  function addProductToDraft(p: { id: string; title: string; price: number; sku: string | null; image: string | null; isOnlineBook: boolean }) {
    setItemDraft((draft) => {
      const list = draft ?? items;
      const existing = list.find((i) => i.product_id === p.id);
      if (existing) {
        return list.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1, line_total: (i.quantity + 1) * i.unit_price } : i,
        );
      }
      const row: OrderItem = {
        id: `tmp-${Date.now()}`,
        order_id: orderId,
        product_id: p.id,
        bundle_id: null,
        is_bundle: false,
        title: p.title,
        sku: p.sku,
        unit_price: p.price,
        quantity: 1,
        line_total: p.price,
        image_url: p.image,
        item_type: p.isOnlineBook ? "ebook" : "physical",
      };
      return [...list, row];
    });
    setShowSearch(false);
    setProductQuery("");
  }

  function updateItemDraft(idx: number, patch: Partial<OrderItem>) {
    setItemDraft((draft) => {
      const list = draft ?? items;
      return list.map((it, i) => (i === idx ? { ...it, ...patch, line_total: Number(patch.unit_price ?? it.unit_price) * Number(patch.quantity ?? it.quantity) } : it));
    });
  }

  function removeItemDraft(idx: number) {
    setItemDraft((draft) => (draft ?? items).filter((_, i) => i !== idx));
  }

  const steadfast = order ? buildSteadfastPayload(order, itemDraft ?? items) : null;
  const isEbookOnly = order?.order_type === "ebook";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="font-mono text-lg font-extrabold text-slate-900">
              {order?.order_no || "…"}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {order && formatDhakaDateTime(order.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order && (
              <>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1",
                    STATUS_STYLE[order.status],
                  )}
                >
                  {STATUS_LABEL[order.status]}
                </span>
                <select
                  value={order.status}
                  onChange={(e) => changeStatus(e.target.value as OrderStatus)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {isLoading || !order || !customer ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {/* Logged-in profile snapshot */}
            {profile && (
              <Section title="Customer Profile (Signed-in User)" icon={User}>
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="size-14 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-14 place-items-center rounded-full bg-slate-200 text-lg font-extrabold text-slate-600">
                      {(profile.full_name || customer.customer_name || "?").slice(0, 1)}
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-extrabold">{profile.full_name || "—"}</p>
                    <p className="font-mono text-xs text-slate-500">{profile.email || "—"}</p>
                    <p className="font-mono text-xs text-slate-500">{profile.phone || "—"}</p>
                    {profile.student_id && (
                      <p className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        Student ID: {profile.student_id}
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Customer editable */}
            <Section title="Customer & Delivery" icon={MapPin} action={
              <button onClick={saveCustomer} className="btn-sm-primary"><Save className="size-3.5" /> Save</button>
            }>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Name" value={customer.customer_name} onChange={(v) => setCustomer({ ...customer, customer_name: v })} />
                <TextField
                  label="Phone"
                  value={customer.customer_phone}
                  onChange={(v) => setCustomer({ ...customer, customer_phone: v.replace(/\D/g, "").slice(0, 11) })}
                  addonRight={
                    <a href={`tel:${customer.customer_phone}`} className="text-brand hover:opacity-80" title="Call">
                      <Phone className="size-4" />
                    </a>
                  }
                />
                <TextField
                  label="Alternative Phone"
                  value={customer.alternative_phone}
                  onChange={(v) => setCustomer({ ...customer, alternative_phone: v.replace(/\D/g, "").slice(0, 15) })}
                  addonRight={
                    customer.alternative_phone ? (
                      <a href={`tel:${customer.alternative_phone}`} className="text-brand hover:opacity-80"><Phone className="size-4" /></a>
                    ) : undefined
                  }
                />
                <TextField
                  label="Email"
                  value={customer.customer_email}
                  onChange={(v) => setCustomer({ ...customer, customer_email: v })}
                  addonRight={<Mail className="size-4 text-slate-400" />}
                />
                {!isEbookOnly && (
                  <>
                    <TextField label="Division" value={customer.division} onChange={(v) => setCustomer({ ...customer, division: v })} />
                    <TextField label="District" value={customer.district} onChange={(v) => setCustomer({ ...customer, district: v })} />
                    <TextField label="Thana / Upazila" value={customer.thana} onChange={(v) => setCustomer({ ...customer, thana: v })} />
                    <TextField className="sm:col-span-2" label="Address (village / area / house / road)" value={customer.address_line} onChange={(v) => setCustomer({ ...customer, address_line: v })} />
                  </>
                )}
                <TextField className="sm:col-span-2" label="Delivery Note (for Steadfast)" value={customer.note} onChange={(v) => setCustomer({ ...customer, note: v })} placeholder="e.g. Deliver by 3 PM" />
              </div>
            </Section>

            {/* Items */}
            <Section title="Items" icon={PackageIcon} action={
              <div className="flex gap-2">
                <button onClick={() => setShowSearch((v) => !v)} className="btn-sm">
                  <Plus className="size-3.5" /> Add Product
                </button>
                <button onClick={saveItems} className="btn-sm-primary"><Save className="size-3.5" /> Save Items</button>
              </div>
            }>
              {showSearch && (
                <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      autoFocus
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Search product title…"
                      className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                    {(prodResults ?? []).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addProductToDraft(p)}
                        className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-slate-100"
                      >
                        {p.image ? (
                          <img src={p.image} alt="" className="size-8 rounded object-cover" />
                        ) : (
                          <div className="size-8 rounded bg-slate-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.title}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {p.sku ?? "no-sku"} · {formatBDT(p.price)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {(itemDraft ?? items).map((it, idx) => (
                  <div key={it.id + idx} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                    {it.image_url ? (
                      <img src={it.image_url} alt="" className="size-12 rounded object-cover" />
                    ) : (
                      <div className="size-12 rounded bg-slate-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{it.title}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {it.sku ?? "no-sku"} · {it.item_type}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateItemDraft(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-center text-sm font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={it.unit_price}
                      onChange={(e) => updateItemDraft(idx, { unit_price: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm font-mono"
                    />
                    <p className="w-24 text-right font-mono text-sm font-bold">
                      {formatBDT(Number(it.quantity) * Number(it.unit_price))}
                    </p>
                    <button onClick={() => removeItemDraft(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-right text-sm">
                <p>Subtotal: <span className="font-mono font-bold">{formatBDT(totals.subtotal)}</span></p>
                <p>Shipping: <span className="font-mono font-bold">{formatBDT(totals.shipping)}</span></p>
                <p className="mt-1 text-base">Total: <span className="font-mono font-extrabold">{formatBDT(totals.total)}</span></p>
              </div>
            </Section>

            {/* Steadfast payload */}
            <Section title="Steadfast Payload (Preview)" icon={Send} action={
              <>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(steadfast, null, 2));
                    toast.success("Copied");
                  }}
                  className="btn-sm"
                >
                  <Copy className="size-3.5" /> Copy JSON
                </button>
                <button className="btn-sm-primary opacity-60" disabled title="Steadfast integration coming soon">
                  <Send className="size-3.5" /> Send to Steadfast
                </button>
              </>
            }>
              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
{JSON.stringify(steadfast, null, 2)}
              </pre>
            </Section>

            {/* Device / Block */}
            <Section title="Device & Security" icon={ShieldAlert}>
              <div className="grid gap-2 sm:grid-cols-3">
                <BlockCard
                  icon={Globe}
                  label="IP Address"
                  value={order.ip || "—"}
                  onBlock={() => order.ip && block("ip", order.ip)}
                />
                <BlockCard
                  icon={Fingerprint}
                  label="Fingerprint"
                  value={order.device_fingerprint || "—"}
                  onBlock={() => order.device_fingerprint && block("fingerprint", order.device_fingerprint)}
                />
                <BlockCard
                  icon={Phone}
                  label="Phone"
                  value={order.customer_phone}
                  onBlock={() => block("phone", order.customer_phone)}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Blocked identifiers cannot place new orders. Manage the full blocklist in settings.
              </p>
            </Section>

            {/* Internal notes */}
            <Section title="Internal Notes (staff only)" icon={StickyNote}>
              <div className="flex gap-2">
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Only staff can see this…"
                  className="min-h-[60px] flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm"
                />
                <button onClick={submitNote} className="btn-sm-primary self-start">
                  <MessageSquarePlus className="size-3.5" /> Add
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {(notes ?? []).map((n: any) => (
                  <div key={n.id} className="rounded-lg border border-slate-200 bg-amber-50/50 p-2 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{formatDhakaDateTime(n.created_at)}</p>
                  </div>
                ))}
                {(!notes || notes.length === 0) && (
                  <p className="text-xs text-slate-400">No internal notes yet.</p>
                )}
              </div>
            </Section>
          </div>
        )}
      </div>

      <style>{`
        .btn-sm { display:inline-flex; align-items:center; gap:0.35rem; padding:0.35rem 0.65rem; border-radius:0.5rem; border:1px solid rgb(226 232 240); background:white; font-size:0.75rem; font-weight:700; color:rgb(51 65 85); }
        .btn-sm:hover { background:rgb(248 250 252); }
        .btn-sm-primary { display:inline-flex; align-items:center; gap:0.35rem; padding:0.35rem 0.65rem; border-radius:0.5rem; background:rgb(15 23 42); color:white; font-size:0.75rem; font-weight:700; }
        .btn-sm-primary:hover { background:rgb(30 41 59); }
      `}</style>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: any;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
          <Icon className="size-4 text-slate-500" />
          {title}
        </h3>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  className,
  placeholder,
  addonRight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  addonRight?: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-slate-400">
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {addonRight}
      </div>
    </label>
  );
}

function BlockCard({
  icon: Icon,
  label,
  value,
  onBlock,
}: {
  icon: any;
  label: string;
  value: string;
  onBlock: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-xs">{value}</p>
      <button
        onClick={onBlock}
        className="mt-2 inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
      >
        <Ban className="size-3" /> Block
      </button>
    </div>
  );
}
