import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BD_LOCATIONS } from "@/lib/bd-locations";

import {
  X,
  Loader2,
  Phone,
  Mail,
  Save,
  Plus,
  Trash2,
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
  Pencil,
  Truck,
  ShieldCheck,
  CheckSquare,
  Square,
  Tag,
} from "lucide-react";
import {
  getAdminOrder,
  updateOrderCustomer,
  updateOrderItems,
  updateOrderStatus,
  addInternalNote,
  searchProductsForOrder,
  bulkBlockIdentifiers,
  bulkUnblockIdentifiers,
  getBlockStatus,
} from "@/lib/orders.functions";
import {
  ORDER_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  formatDhakaDateTime,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders";
import { formatBDTEn, waLinkBD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { confirm as confirmDialog, promptText } from "@/components/ui/confirm-dialog";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

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
  const bulkBlock = useServerFn(bulkBlockIdentifiers);
  const bulkUnblock = useServerFn(bulkUnblockIdentifiers);
  const fetchBlockStatus = useServerFn(getBlockStatus);
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
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const queryClient = useQueryClient();

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
      setDeliveryNote(order.note ?? "");
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
    staleTime: 0,
  });

  // Realtime: refetch product search results when any product changes
  useEffect(() => {
    if (!showSearch) return;
    const channel = supabase
      .channel(`order-drawer-products-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["order-product-search"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showSearch, orderId, queryClient]);

  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [custErrors, setCustErrors] = useState<Record<string, string>>({});

  function validateCustomer(): Record<string, string> {
    const errs: Record<string, string> = {};
    const name = (customer?.customer_name ?? "").trim();
    if (name.length < 3) errs.customer_name = "Name must be at least 3 characters";
    if (!/^01[3-9]\d{8}$/.test(customer?.customer_phone ?? ""))
      errs.customer_phone = "Enter a valid 11-digit BD phone (01XXXXXXXXX)";
    if (customer?.alternative_phone && !/^01[3-9]\d{8}$/.test(customer.alternative_phone))
      errs.alternative_phone = "Alternative phone must also be a valid BD phone";
    const email = (customer?.customer_email ?? "").trim();
    if (email) {
      const em = z.string().email().safeParse(email);
      if (!em.success) errs.customer_email = "Enter a valid email";
    }
    if (!isEbookOnly) {
      if (!customer?.division) errs.division = "Select division";
      if (!customer?.district) errs.district = "Select district";
      if (!customer?.thana) errs.thana = "Select thana / upazila";
      if ((customer?.address_line ?? "").trim().length < 5)
        errs.address_line = "Address must be at least 5 characters";
    }
    return errs;
  }

  async function saveCustomer() {
    const errs = validateCustomer();
    setCustErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSavingCustomer(true);
    try {
      const { note: _note, ...rest } = customer;
      await upCustomer({ data: { id: orderId, patch: rest } });
      toast.success("Customer details saved");
      setIsEditingCustomer(false);
      setCustErrors({});
      refetch();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function saveDeliveryNote() {
    const note = deliveryNote.trim();
    if (note.length > 500) {
      toast.error("Delivery note must be under 500 characters");
      return;
    }
    setSavingNote(true);
    try {
      await upCustomer({ data: { id: orderId, patch: { note: note || null } } });
      setCustomer((c: any) => ({ ...c, note }));
      toast.success(note ? "Delivery note saved" : "Delivery note cleared");
      refetch();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  function cancelCustomerEdit() {
    if (!order) return;
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
    setIsEditingCustomer(false);
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
    if (!order || s === order.status) return;

    // Hold / Cancel require a written reason before we commit the status change.
    let reasonNote: string | undefined;
    if (s === "hold" || s === "cancelled") {
      const isHold = s === "hold";
      const reason = await promptText({
        title: isHold ? "Put order on hold?" : "Cancel this order?",
        description: isHold
          ? "Please write a short reason for putting this order on hold. It will be saved to the order's status history."
          : "Please write a short reason for cancelling this order. It will be saved to the order's status history.",
        inputLabel: "Reason",
        placeholder: isHold
          ? "e.g. Customer asked to pause, awaiting stock, address unclear…"
          : "e.g. Customer requested cancellation, duplicate order, out of stock…",
        multiline: true,
        minLength: 3,
        maxLength: 500,
        variant: isHold ? "warning" : "danger",
        confirmLabel: isHold ? "Confirm Hold" : "Confirm Cancel",
        cancelLabel: "Back",
      });
      if (!reason) return; // user cancelled or dismissed
      reasonNote = reason;
    }

    try {
      await upStatus({ data: { id: orderId, status: s, note: reasonNote } });
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

  const activeItems = itemDraft ?? items;
  const hasPhysical = activeItems.some((i: any) => (i.item_type ?? i.type) !== "ebook");
  const isEbookOnly = !hasPhysical && order?.order_type === "ebook";

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
            <Section
              title="Customer & Delivery"
              icon={MapPin}
              action={
                isEditingCustomer ? (
                  <>
                    <button onClick={cancelCustomerEdit} className="btn-sm" disabled={savingCustomer}>
                      Cancel
                    </button>
                    <button
                      onClick={saveCustomer}
                      className="btn-sm-primary disabled:opacity-60"
                      disabled={savingCustomer}
                    >
                      {savingCustomer ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      {savingCustomer ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setIsEditingCustomer(true);
                      setCustErrors({});
                    }}
                    className="btn-sm"
                    title="Edit customer details"
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                )
              }
            >
              {isEditingCustomer ? (
                <CustomerEditForm
                  customer={customer}
                  setCustomer={setCustomer}
                  errors={custErrors}
                  isEbookOnly={isEbookOnly}
                />
              ) : (
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <ReadField label="Name" value={customer.customer_name} />
                  <PhoneField
                    label="Phone"
                    phone={customer.customer_phone}
                  />
                  <PhoneField
                    label="Alternative Phone"
                    phone={customer.alternative_phone}
                  />
                  <ReadField
                    label="Email"
                    value={customer.customer_email || "—"}
                    href={customer.customer_email ? `mailto:${customer.customer_email}` : undefined}
                    icon={customer.customer_email ? <Mail className="size-3.5 text-slate-400" /> : undefined}
                  />
                  {!isEbookOnly && (
                    <>
                      <ReadField label="Division" value={customer.division || "—"} />
                      <ReadField label="District" value={customer.district || "—"} />
                      <ReadField label="Thana / Upazila" value={customer.thana || "—"} />
                      <ReadField className="sm:col-span-2" label="Address (village / area / house / road)" value={customer.address_line || "—"} />
                    </>
                  )}
                </div>
              )}
            </Section>

            {/* Delivery Note — only shown when the order has a physical item */}
            {!isEbookOnly && (
              <Section
                title="Delivery Note (for Steadfast)"
                icon={Truck}
                action={
                  <button
                    onClick={saveDeliveryNote}
                    className="btn-sm-primary disabled:opacity-60"
                    disabled={savingNote || deliveryNote === (customer.note ?? "")}
                  >
                    {savingNote ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    {savingNote ? "Saving…" : "Save Note"}
                  </button>
                }
              >
                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value.slice(0, 500))}
                  placeholder="Optional — e.g. Deliver by 3 PM, call before arrival, leave with security… (sent to Steadfast when provided)"
                  rows={6}
                  className="min-h-[180px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {deliveryNote.length}/500 characters · optional, forwarded to Steadfast when set
                </p>
              </Section>
            )}



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
                            {p.sku ?? "no-sku"} · {formatBDTEn(p.price)}
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
                      {formatBDTEn(Number(it.quantity) * Number(it.unit_price))}
                    </p>
                    <button onClick={() => removeItemDraft(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-right text-sm">
                <p>Subtotal: <span className="font-mono font-bold">{formatBDTEn(totals.subtotal)}</span></p>
                <p>Shipping: <span className="font-mono font-bold">{formatBDTEn(totals.shipping)}</span></p>
                <p className="mt-1 text-base">Total: <span className="font-mono font-extrabold">{formatBDTEn(totals.total)}</span></p>
              </div>
            </Section>

            {/* Source attribution */}
            <SourceSection order={order} />



            {/* Device / Block */}
            <DeviceSecuritySection
              order={order}
              fetchBlockStatus={fetchBlockStatus}
              bulkBlock={bulkBlock}
              bulkUnblock={bulkUnblock}
            />

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

function ReadField({
  label,
  value,
  href,
  icon,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <span className="inline-flex items-center gap-1.5 break-all text-sm font-semibold text-slate-900">
      {icon}
      {href ? <span className="text-brand hover:underline">{value}</span> : value}
    </span>
  );
  return (
    <div className={cn("block", className)}>
      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {href ? <a href={href}>{body}</a> : body}
    </div>
  );
}

function PhoneField({ label, phone }: { label: string; phone?: string | null }) {
  const value = (phone ?? "").trim();
  const wa = waLinkBD(value);
  if (!value) {
    return (
      <div className="block">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <span className="text-sm font-semibold text-slate-400">—</span>
      </div>
    );
  }
  return (
    <div className="block">
      <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            title="Open WhatsApp chat"
            className="inline-flex items-center justify-center rounded-md bg-emerald-50 p-1.5 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100"
          >
            <WhatsAppIcon className="size-4" />
          </a>
        )}
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand/10 px-2 py-1 text-sm font-semibold text-brand hover:bg-brand/15"
        >
          <Phone className="size-3.5" />
          <span className="font-mono">{value}</span>
        </a>
      </div>
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
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  addonRight?: React.ReactNode;
  error?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-white px-3 py-2 focus-within:border-slate-400",
          error ? "border-rose-400" : "border-slate-200",
        )}
      >
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {addonRight}
      </div>
      {error && (
        <span className="mt-1 block text-[11px] font-semibold text-rose-600">{error}</span>
      )}
    </label>
  );
}


// ---------- Source attribution ----------
const SOURCE_META: Record<string, { label: string; className: string }> = {
  website: { label: "Website", className: "bg-sky-100 text-sky-700 ring-sky-200" },
  direct: { label: "Direct", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  manual: { label: "Manual", className: "bg-violet-100 text-violet-700 ring-violet-200" },
  fb_utm: { label: "Facebook / UTM", className: "bg-indigo-100 text-indigo-700 ring-indigo-200" },
  google: { label: "Google", className: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  other: { label: "Other", className: "bg-amber-100 text-amber-800 ring-amber-200" },
};

function SourceSection({ order }: { order: Order & { created_by_name?: string | null } }) {
  const src = (order as any).source || "website";
  const meta = SOURCE_META[src] ?? SOURCE_META.other;
  const detail = (order as any).source_detail as string | null | undefined;
  const empName = (order as any).created_by_name as string | null | undefined;
  return (
    <Section title="Order Source" icon={Tag}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", meta.className)}>
          <Tag className="size-3" /> {meta.label}
        </span>
        {detail && (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {detail}
          </span>
        )}
        {src === "manual" && empName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-100 px-2.5 py-1 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-200">
            <User className="size-3" /> {empName}
          </span>
        )}
        {!detail && src === "website" && (
          <span className="text-[11px] text-slate-500">Placed via the storefront checkout.</span>
        )}
      </div>
    </Section>
  );
}

type BlockKind = "ip" | "fingerprint" | "phone";

function DeviceSecuritySection({
  order,
  fetchBlockStatus,
  bulkBlock,
  bulkUnblock,
}: {
  order: Order;
  fetchBlockStatus: (a: { data: { items: Array<{ kind: BlockKind; value: string }> } }) => Promise<any>;
  bulkBlock: (a: { data: { items: Array<{ kind: BlockKind; value: string }>; reason?: string } }) => Promise<any>;
  bulkUnblock: (a: { data: { items: Array<{ kind: BlockKind; value: string }> } }) => Promise<any>;
}) {
  const identifiers = useMemo(
    () =>
      (
        [
          { kind: "ip" as const, label: "IP Address", icon: Globe, value: order.ip || "" },
          { kind: "fingerprint" as const, label: "Fingerprint", icon: Fingerprint, value: order.device_fingerprint || "" },
          { kind: "phone" as const, label: "Phone", icon: Phone, value: order.customer_phone || "" },
        ] as const
      ).filter((i) => !!i.value),
    [order.ip, order.device_fingerprint, order.customer_phone],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["order-block-status", order.id, identifiers.map((i) => `${i.kind}:${i.value}`).join("|")],
    queryFn: () => fetchBlockStatus({ data: { items: identifiers.map((i) => ({ kind: i.kind, value: i.value })) } }),
    enabled: identifiers.length > 0,
    staleTime: 0,
  });

  const blockedSet = useMemo(() => {
    const rows = (statusQuery.data ?? []) as Array<{ kind: BlockKind; value: string }>;
    return new Set(rows.map((r) => `${r.kind}:${r.value}`));
  }, [statusQuery.data]);

  const keyOf = (kind: BlockKind, value: string) => `${kind}:${value}`;
  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(identifiers.map((i) => keyOf(i.kind, i.value))));
  const clearSel = () => setSelected(new Set());

  const selectedItems = identifiers.filter((i) => selected.has(keyOf(i.kind, i.value)));
  const anySelected = selectedItems.length > 0;
  const selectedToBlock = selectedItems.filter((i) => !blockedSet.has(keyOf(i.kind, i.value)));
  const selectedToUnblock = selectedItems.filter((i) => blockedSet.has(keyOf(i.kind, i.value)));

  async function doBlock() {
    if (!selectedToBlock.length) return;
    const ok = await confirmDialog({
      variant: "danger",
      title: `Block ${selectedToBlock.length} identifier(s)?`,
      description: "Once blocked, this device, IP or phone cannot place new orders. You can unblock any time.",
      confirmLabel: "Block",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await bulkBlock({ data: { items: selectedToBlock.map((i) => ({ kind: i.kind, value: i.value })) } });
      toast.success(`Blocked ${selectedToBlock.length} identifier(s)`);
      clearSel();
      statusQuery.refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to block");
    } finally {
      setBusy(false);
    }
  }

  async function doUnblock() {
    if (!selectedToUnblock.length) return;
    const ok = await confirmDialog({
      variant: "warning",
      title: `Unblock ${selectedToUnblock.length} identifier(s)?`,
      description: "These identifiers will be allowed to place orders again.",
      confirmLabel: "Unblock",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await bulkUnblock({ data: { items: selectedToUnblock.map((i) => ({ kind: i.kind, value: i.value })) } });
      toast.success(`Unblocked ${selectedToUnblock.length} identifier(s)`);
      clearSel();
      statusQuery.refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to unblock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Device & Security"
      icon={ShieldAlert}
      action={
        <>
          <button
            onClick={selected.size === identifiers.length ? clearSel : selectAll}
            className="btn-sm"
            disabled={identifiers.length === 0}
          >
            {selected.size === identifiers.length ? "Clear" : "Select all"}
          </button>
          <button
            onClick={doBlock}
            disabled={busy || selectedToBlock.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-rose-700"
          >
            <Ban className="size-3.5" /> Block {selectedToBlock.length || ""}
          </button>
          <button
            onClick={doUnblock}
            disabled={busy || selectedToUnblock.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40 hover:bg-emerald-700"
          >
            <ShieldCheck className="size-3.5" /> Unblock {selectedToUnblock.length || ""}
          </button>
        </>
      }
    >
      {identifiers.length === 0 ? (
        <p className="text-xs text-slate-500">No identifiers to block for this order.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {identifiers.map(({ kind, label, icon: Icon, value }) => {
            const k = keyOf(kind, value);
            const isSelected = selected.has(k);
            const isBlocked = blockedSet.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                className={cn(
                  "group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                  isSelected
                    ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300"
                    : isBlocked
                      ? "border-rose-200 bg-rose-50/60 hover:bg-rose-50"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <Icon className="size-3" /> {label}
                  </span>
                  <span className={cn("shrink-0", isSelected ? "text-indigo-600" : "text-slate-300")}>
                    {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                  </span>
                </div>
                <p className="w-full break-all font-mono text-xs font-semibold text-slate-900">{value}</p>
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                    isBlocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  {isBlocked ? "Blocked" : "Active"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-500">
        Select any combination and use Block or Unblock. Blocked identifiers cannot place new orders — enforced server-side at checkout.
      </p>
    </Section>
  );
}

function CustomerEditForm({
  customer,
  setCustomer,
  errors,
  isEbookOnly,
}: {
  customer: any;
  setCustomer: (v: any) => void;
  errors: Record<string, string>;
  isEbookOnly: boolean;
}) {
  const districts = useMemo(
    () => BD_LOCATIONS.find((d) => d.name === customer.division)?.districts ?? [],
    [customer.division],
  );
  const upazilas = useMemo(
    () => districts.find((d) => d.name === customer.district)?.upazilas ?? [],
    [districts, customer.district],
  );

  const selectCls =
    "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400";
  const cls = (hasError: boolean) =>
    cn(selectCls, hasError ? "border-rose-400" : "border-slate-200");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="Name *"
        value={customer.customer_name}
        onChange={(v) => setCustomer({ ...customer, customer_name: v.slice(0, 100) })}
        error={errors.customer_name}
      />
      <TextField
        label="Phone *"
        value={customer.customer_phone}
        onChange={(v) => setCustomer({ ...customer, customer_phone: v.replace(/\D/g, "").slice(0, 11) })}
        placeholder="01XXXXXXXXX"
        error={errors.customer_phone}
        addonRight={
          <a href={`tel:${customer.customer_phone}`} className="text-brand hover:opacity-80" title="Call">
            <Phone className="size-4" />
          </a>
        }
      />
      <TextField
        label="Alternative Phone"
        value={customer.alternative_phone}
        onChange={(v) => setCustomer({ ...customer, alternative_phone: v.replace(/\D/g, "").slice(0, 11) })}
        placeholder="Optional"
        error={errors.alternative_phone}
        addonRight={
          customer.alternative_phone ? (
            <a href={`tel:${customer.alternative_phone}`} className="text-brand hover:opacity-80">
              <Phone className="size-4" />
            </a>
          ) : undefined
        }
      />
      <TextField
        label="Email"
        value={customer.customer_email}
        onChange={(v) => setCustomer({ ...customer, customer_email: v.slice(0, 200) })}
        placeholder="Optional"
        error={errors.customer_email}
        addonRight={<Mail className="size-4 text-slate-400" />}
      />
      {!isEbookOnly && (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Division *
            </span>
            <select
              value={customer.division ?? ""}
              onChange={(e) =>
                setCustomer({ ...customer, division: e.target.value, district: "", thana: "" })
              }
              className={cls(!!errors.division)}
            >
              <option value="">Select division…</option>
              {BD_LOCATIONS.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.division && (
              <span className="mt-1 block text-[11px] font-semibold text-rose-600">{errors.division}</span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              District *
            </span>
            <select
              value={customer.district ?? ""}
              onChange={(e) => setCustomer({ ...customer, district: e.target.value, thana: "" })}
              disabled={!customer.division}
              className={cn(cls(!!errors.district), "disabled:opacity-50")}
            >
              <option value="">Select district…</option>
              {districts.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
            {errors.district && (
              <span className="mt-1 block text-[11px] font-semibold text-rose-600">{errors.district}</span>
            )}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Thana / Upazila *
            </span>
            <select
              value={customer.thana ?? ""}
              onChange={(e) => setCustomer({ ...customer, thana: e.target.value })}
              disabled={!customer.district}
              className={cn(cls(!!errors.thana), "disabled:opacity-50")}
            >
              <option value="">Select thana / upazila…</option>
              {upazilas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            {errors.thana && (
              <span className="mt-1 block text-[11px] font-semibold text-rose-600">{errors.thana}</span>
            )}
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Address (village / area / house / road) *
            </span>
            <textarea
              value={customer.address_line ?? ""}
              onChange={(e) => setCustomer({ ...customer, address_line: e.target.value.slice(0, 250) })}
              placeholder="Village, road, landmark…"
              rows={2}
              className={cn(
                "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400",
                errors.address_line ? "border-rose-400" : "border-slate-200",
              )}
            />
            {errors.address_line && (
              <span className="mt-1 block text-[11px] font-semibold text-rose-600">{errors.address_line}</span>
            )}
          </label>
        </>
      )}
    </div>
  );
}


