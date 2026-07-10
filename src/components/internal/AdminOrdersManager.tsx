import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Phone, Eye, Search, Fingerprint, Globe } from "lucide-react";
import { listAdminOrders } from "@/lib/orders.functions";
import { ORDER_STATUSES, STATUS_LABEL, formatDhakaDateTime, type OrderStatus } from "@/lib/orders";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminOrderDrawer } from "@/components/internal/AdminOrderDrawer";
import { AdminIncompleteCheckouts } from "@/components/internal/AdminIncompleteCheckouts";

export function AdminOrdersManager() {
  const [tab, setTab] = useState<OrderStatus>("processing");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchOrders = useServerFn(listAdminOrders);
  const isIncomplete = tab === "incomplete";

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders", tab, search],
    queryFn: () => fetchOrders({ data: { status: tab, search: search || undefined, limit: 200 } }),
    enabled: !isIncomplete,
  });

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Track, fulfill and manage every order placed through your storefront.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {ORDER_STATUSES.map((s) => {
          const active = tab === s;
          const c = counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {STATUS_LABEL[s]}
              <span
                className={cn(
                  "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                  active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700",
                )}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order no, phone, name…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-slate-400"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Created (Asia/Dhaka)</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Device / IP</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No orders in <span className="font-extrabold">{STATUS_LABEL[tab]}</span>.
                  </td>
                </tr>
              ) : (
                orders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-extrabold text-slate-900">{o.order_no}</p>
                      <p className="text-[11px] text-slate-500">
                        {o.order_type} · {o.payment_status}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                      {formatDhakaDateTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{o.customer_name}</p>
                      <a
                        href={`tel:${o.customer_phone}`}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs font-bold text-brand hover:underline"
                      >
                        <Phone className="size-3" />
                        {o.customer_phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <Globe className="size-3" />
                        {o.ip || "—"}
                      </p>
                      <p className="mt-0.5 inline-flex max-w-[180px] items-center gap-1 truncate font-mono text-[11px] text-slate-500">
                        <Fingerprint className="size-3 shrink-0" />
                        <span className="truncate">{o.device_fingerprint || "—"}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-extrabold text-slate-900">
                      {formatBDT(Number(o.total_bdt))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setOpenId(o.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        <Eye className="size-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openId && (
        <AdminOrderDrawer
          orderId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => refetch()}
        />
      )}

      {isFetching && !isLoading && (
        <p className="text-right text-[11px] font-semibold text-slate-400">Refreshing…</p>
      )}
    </div>
  );
}
