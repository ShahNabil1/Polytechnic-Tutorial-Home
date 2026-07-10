// Shared order types + Steadfast payload builder.

export type OrderStatus =
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "hold"
  | "delivered"
  | "cancelled"
  | "returned"
  | "incomplete";

export const ORDER_STATUSES: OrderStatus[] = [
  "processing",
  "ready_to_ship",
  "shipped",
  "hold",
  "delivered",
  "cancelled",
  "returned",
  "incomplete",
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Processing",
  ready_to_ship: "Ready To Ship",
  shipped: "Shipped",
  hold: "Hold",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  incomplete: "Incomplete Order",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  processing: "bg-blue-100 text-blue-800 ring-blue-300",
  ready_to_ship: "bg-violet-100 text-violet-800 ring-violet-300",
  shipped: "bg-indigo-100 text-indigo-800 ring-indigo-300",
  hold: "bg-amber-100 text-amber-800 ring-amber-300",
  delivered: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelled: "bg-rose-100 text-rose-800 ring-rose-300",
  returned: "bg-orange-100 text-orange-800 ring-orange-300",
  incomplete: "bg-slate-100 text-slate-700 ring-slate-300",
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  bundle_id: string | null;
  is_bundle: boolean;
  title: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url: string | null;
  item_type: "physical" | "ebook";
};

export type Order = {
  id: string;
  order_no: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  alternative_phone: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  address_line: string | null;
  full_address: string | null;
  subtotal_bdt: number;
  shipping_bdt: number;
  discount_bdt: number;
  total_bdt: number;
  cod_amount: number;
  payment_status: string;
  payment_method: string | null;
  status: OrderStatus;
  order_type: "physical" | "ebook" | "mixed";
  has_physical: boolean;
  delivery_type: number;
  note: string | null;
  item_description: string | null;
  ip: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  steadfast_consignment_id: string | null;
  steadfast_tracking_code: string | null;
  steadfast_status: string | null;
  steadfast_synced_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type SteadfastPayload = {
  invoice: string;
  recipient_name: string;
  recipient_phone: string;
  alternative_phone?: string;
  recipient_email?: string;
  recipient_address: string;
  cod_amount: number;
  note?: string;
  item_description?: string;
  total_lot: number;
  delivery_type: 0 | 1;
};

export function composeItemDescription(items: Pick<OrderItem, "title" | "quantity">[]) {
  return items.map((i) => `${i.title} x${i.quantity}`).join(", ").slice(0, 500);
}

export function composeFullAddress(o: Pick<Order, "address_line" | "thana" | "district" | "division">) {
  return [o.address_line, o.thana, o.district, o.division]
    .filter(Boolean)
    .join(", ")
    .slice(0, 250);
}

export function buildSteadfastPayload(order: Order, items: OrderItem[]): SteadfastPayload {
  const totalLot = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const payload: SteadfastPayload = {
    invoice: order.order_no,
    recipient_name: order.customer_name,
    recipient_phone: order.customer_phone,
    recipient_address:
      order.full_address ||
      composeFullAddress(order) ||
      "N/A",
    cod_amount: Number(order.cod_amount ?? 0),
    total_lot: totalLot || 1,
    delivery_type: 0,
    item_description: order.item_description || composeItemDescription(items),
  };
  if (order.alternative_phone) payload.alternative_phone = order.alternative_phone;
  if (order.customer_email) payload.recipient_email = order.customer_email;
  if (order.note) payload.note = order.note;
  return payload;
}

export function formatDhakaDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return iso;
  }
}
