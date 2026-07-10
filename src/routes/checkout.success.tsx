import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, Mail, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { formatBDT, toBanglaNumber } from "@/lib/format";
import { productTypeLabel } from "@/lib/products";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  order: z.string().min(1),
  digital: z.coerce.number().optional(),
});

type OrderStatus =
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "hold"
  | "delivered"
  | "cancelled"
  | "returned"
  | "incomplete"
  | "pending";

type OrderSnapshot = {
  orderNo: string;
  status?: OrderStatus;
  createdAt: number;
  customer: {
    name: string;
    phone: string;
    email: string;
    division: string;
    district: string;
    upazila: string;
    address: string;
  };
  items: Array<{
    productId: string;
    title: string;
    type: string;
    isOnlineBook?: boolean;
    price: number;
    quantity: number;
    image?: string;
    coverEmoji?: string;
    coverColor?: string;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  isPhysical: boolean;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  ready_to_ship: "Ready To Ship",
  shipped: "Shipped",
  hold: "Hold",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  incomplete: "Incomplete",
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 ring-amber-300",
  processing: "bg-blue-100 text-blue-800 ring-blue-300",
  ready_to_ship: "bg-violet-100 text-violet-800 ring-violet-300",
  shipped: "bg-indigo-100 text-indigo-800 ring-indigo-300",
  hold: "bg-amber-100 text-amber-800 ring-amber-300",
  delivered: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  cancelled: "bg-rose-100 text-rose-800 ring-rose-300",
  returned: "bg-orange-100 text-orange-800 ring-orange-300",
  incomplete: "bg-slate-100 text-slate-700 ring-slate-300",
};

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "অর্ডার সফল — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: SuccessPage,
});

function SuccessPage() {
  const { order, digital } = Route.useSearch();
  const isDigital = digital === 1;
  const [snap, setSnap] = useState<OrderSnapshot | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`order:${order}`);
      if (raw) setSnap(JSON.parse(raw) as OrderSnapshot);
    } catch {}
  }, [order]);

  return (
    <div className="px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Hero */}
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-xl md:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
            <CheckCircle2 className="size-9" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold md:text-3xl">
            অর্ডার সফল হয়েছে!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            আপনার অর্ডারের জন্য ধন্যবাদ।
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-2 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Order ID
              </p>
              <p className="font-inter text-lg font-extrabold tracking-wider text-brand">
                {order}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-2 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1",
                  STATUS_STYLE[(snap?.status ?? "processing") as OrderStatus],
                )}
              >
                {STATUS_LABEL[(snap?.status ?? "processing") as OrderStatus]}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-surface p-4 text-left text-sm">
            {isDigital ? (
              <div className="flex gap-3">
                <Download className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <p className="font-semibold">ডাউনলোড লিংক পাঠানো হয়েছে</p>
                  <p className="mt-1 text-muted-foreground">
                    আপনার ইমেইলে সিকিউর ডাউনলোড লিংক পাঠানো হয়েছে। ইমেইল না পেলে স্প্যাম ফোল্ডার চেক করুন।
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-brand" />
                <div>
                  <p className="font-semibold">অর্ডার কনফার্মেশন</p>
                  <p className="mt-1 text-muted-foreground">
                    আমাদের টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে। সাধারণত ২-৩ কর্মদিবসে বই আপনার ঠিকানায় পৌঁছে যাবে।
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {snap && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">অর্ডার সামারি</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface"
              >
                <Printer className="size-3.5" /> প্রিন্ট
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-surface p-4 text-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  কাস্টমার
                </p>
                <p className="mt-1 font-bold">{snap.customer.name}</p>
                <p className="font-inter text-xs">{snap.customer.phone}</p>
                {snap.customer.email && (
                  <p className="font-inter text-xs">{snap.customer.email}</p>
                )}
              </div>
              {snap.isPhysical && (
                <div className="rounded-xl bg-surface p-4 text-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ডেলিভারি ঠিকানা
                  </p>
                  <p className="mt-1 leading-snug">
                    {snap.customer.address}, {snap.customer.upazila}, {snap.customer.district}, {snap.customer.division}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-4">
              {snap.items.map((i) => (
                <div key={i.productId} className="flex gap-3">
                  <div
                    className={cn(
                      "grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br text-xl",
                      !i.image && (i.coverColor ?? "from-slate-200 to-slate-400"),
                    )}
                  >
                    {i.image ? (
                      <img src={i.image} alt={i.title} className="h-full w-full object-cover" />
                    ) : (
                      i.coverEmoji ?? "📦"
                    )}
                  </div>
                  <div className="flex flex-1 flex-col text-sm">
                    <p className="line-clamp-2 font-bold leading-snug">{i.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {i.isOnlineBook ? "অনলাইন বুক" : productTypeLabel(i.type as never)} ×{" "}
                      <span className="font-inter tabular-nums">{toBanglaNumber(i.quantity)}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">
                    {formatBDT(i.price * i.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">সাবটোটাল</span>
                <span className="font-bold tabular-nums">{formatBDT(snap.subtotal)}</span>
              </div>
              {snap.isPhysical && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                  <span className="tabular-nums">{formatBDT(snap.shipping)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-dashed border-border pt-3">
                <span className="text-base font-extrabold">সর্বমোট</span>
                <span className="text-xl font-extrabold tabular-nums">{formatBDT(snap.total)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          >
            আরো শপিং করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
