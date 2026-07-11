import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Phone, Eye, Search } from "lucide-react";
import { listAdminOrders, getAdminOrderCounts } from "@/lib/orders.functions";
import { ORDER_STATUSES, STATUS_LABEL, formatDhakaDateTime, type OrderStatus } from "@/lib/orders";
import { formatBDTEn, waLinkBD } from "@/lib/format";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { cn } from "@/lib/utils";
import { AdminOrderDrawer } from "@/components/internal/AdminOrderDrawer";
import { AdminIncompleteCheckouts } from "@/components/internal/AdminIncompleteCheckouts";
import { supabase } from "@/integrations/supabase/client";

export function AdminOrdersManager() {
  const [tab, setTab] = useState<OrderStatus>("processing");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchOrders = useServerFn(listAdminOrders);
  const fetchCounts = useServerFn(getAdminOrderCounts);
  const queryClient = useQueryClient();
  const isIncomplete = tab === "incomplete";

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders", tab, search],
    queryFn: () => fetchOrders({ data: { status: tab, search: search || undefined, limit: 200 } }),
  });

  // Counts fetched independently so badges stay accurate on every tab, including Incomplete.
  const { data: countsData } = useQuery({
    queryKey: ["admin-order-counts"],
    queryFn: () => fetchCounts(),
    refetchOnWindowFocus: true,
  });

  // Realtime: any change in orders or incomplete_checkouts refreshes the visible list and counts.
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-order-counts"] });
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "incomplete_checkouts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-order-counts"] });
        queryClient.invalidateQueries({ queryKey: ["admin-incomplete"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const orders = data?.orders ?? [];
  const counts = countsData?.counts ?? data?.counts ?? {};

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

      {isIncomplete ? (
        <AdminIncompleteCheckouts search={search} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-indigo-100/70 to-sky-100/70 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/70">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Created (Asia/Dhaka)</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100/70">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-indigo-400" />
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      No orders in <span className="font-extrabold">{STATUS_LABEL[tab]}</span>.
                    </td>
                  </tr>
                ) : (
                  orders.map((o: any) => (
                    <tr key={o.id} className="transition-colors hover:bg-indigo-50/60">
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-mono text-sm font-extrabold text-slate-900">{o.order_no}</p>
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                          {o.order_type} · {o.payment_status}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-top text-xs font-semibold text-slate-700">
                        {formatDhakaDateTime(o.created_at)}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-900">{o.customer_name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {waLinkBD(o.customer_phone) && (
                            <a
                              href={waLinkBD(o.customer_phone)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open WhatsApp chat"
                              className="inline-flex items-center justify-center rounded-md bg-emerald-50 p-1 ring-1 ring-emerald-200 hover:bg-emerald-100"
                            >
                              <WhatsAppIcon className="size-3.5" />
                            </a>
                          )}
                          <a
                            href={`tel:${o.customer_phone}`}
                            className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-xs font-bold text-brand hover:bg-brand/15"
                          >
                            <Phone className="size-3" />
                            {o.customer_phone}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top text-right font-mono text-sm font-extrabold text-slate-900">
                        {formatBDTEn(Number(o.total_bdt))}
                      </td>
                      <td className="px-4 py-3.5 align-top text-right">
                        <button
                          onClick={() => setOpenId(o.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:from-indigo-700 hover:to-sky-700"
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
      )}

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
