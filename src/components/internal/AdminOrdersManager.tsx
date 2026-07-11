import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Phone, Eye, Search, Truck, CheckSquare, Square } from "lucide-react";
import { listAdminOrders, getAdminOrderCounts } from "@/lib/orders.functions";
import { ORDER_STATUSES, STATUS_LABEL, DIGITAL_STATUS_LABEL, DIGITAL_STATUS_STYLE, PHYSICAL_STATUS_LABEL, formatDhakaDateTime, type OrderStatus, type DigitalStatus, type PhysicalStatus } from "@/lib/orders";
import { formatBDTEn, waLinkBD } from "@/lib/format";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { cn } from "@/lib/utils";
import { AdminOrderDrawer } from "@/components/internal/AdminOrderDrawer";
import { AdminIncompleteCheckouts } from "@/components/internal/AdminIncompleteCheckouts";
import { Pagination } from "@/components/internal/Pagination";
import { ResendEventChips } from "@/components/internal/ResendEventChips";
import {
  SteadfastEventChips,
  SteadfastTrackingCard,
  FailedRTSBadge,
} from "@/components/internal/SteadfastEventChips";
import { BulkRTSDialog, type BulkDispatchOrder } from "@/components/internal/BulkRTSDialog";
import { supabase } from "@/integrations/supabase/client";

function FulfillmentChips({ o }: { o: any }) {
  const digital = (o.digital_status ?? "not_applicable") as DigitalStatus;
  const physical = (o.physical_status ?? "not_applicable") as PhysicalStatus;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {o.order_type}
      </span>
      {digital !== "not_applicable" && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
            DIGITAL_STATUS_STYLE[digital],
          )}
          title="Digital delivery"
        >
          📩 {DIGITAL_STATUS_LABEL[digital]}
        </span>
      )}
      {physical !== "not_applicable" && (
        <span
          className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-200"
          title="Physical shipment"
        >
          📦 {PHYSICAL_STATUS_LABEL[physical]}
        </span>
      )}
    </div>
  );
}

export function AdminOrdersManager() {
  const [tab, setTab] = useState<OrderStatus>("processing");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkOrders, setBulkOrders] = useState<BulkDispatchOrder[]>([]);

  const fetchOrders = useServerFn(listAdminOrders);
  const fetchCounts = useServerFn(getAdminOrderCounts);
  const queryClient = useQueryClient();
  const isIncomplete = tab === "incomplete";
  const isProcessing = tab === "processing";

  // Reset selection whenever the filters that change the visible row set change.
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [tab, search, pageSize]);

  const offset = (page - 1) * pageSize;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders", tab, search, page, pageSize],
    queryFn: () =>
      fetchOrders({
        data: { status: tab, search: search || undefined, limit: pageSize, offset },
      }),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "order_email_deliveries" }, () => {
        // Resend webhook → any sent/delivered/opened/clicked/bounced update refreshes chips live.
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        queryClient.invalidateQueries({ queryKey: ["admin-order"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const counts = countsData?.counts ?? data?.counts ?? {};

  // Bulk-select derived state (only relevant on Processing tab).
  const selectablePhysicalIds = useMemo(
    () => orders.filter((o: any) => o.has_physical).map((o: any) => o.id as string),
    [orders],
  );
  const selectedList = useMemo(
    () => orders.filter((o: any) => selected.has(o.id)),
    [orders, selected],
  );
  const selectionHasNonPhysical = selectedList.some((o: any) => !o.has_physical);
  const allPhysicalSelected =
    selectablePhysicalIds.length > 0 &&
    selectablePhysicalIds.every((id: string) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAllPhysical() {
    setSelected((cur) => {
      if (allPhysicalSelected) {
        const next = new Set(cur);
        for (const id of selectablePhysicalIds) next.delete(id);
        return next;
      }
      const next = new Set(cur);
      for (const id of selectablePhysicalIds) next.add(id);
      return next;
    });
  }

  function openBulkRTS() {
    const payload: BulkDispatchOrder[] = selectedList
      .filter((o: any) => o.has_physical)
      .map((o: any) => ({ id: o.id, order_no: o.order_no }));
    if (payload.length === 0) return;
    setBulkOrders(payload);
    setBulkOpen(true);
  }



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
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/60 shadow-sm">
            <div className="border-b border-indigo-100/70 bg-indigo-50/60 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
              {orders.length} promoted incomplete order{orders.length === 1 ? "" : "s"}
            </div>
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
                      <td colSpan={5} className="px-4 py-6 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin text-indigo-400" />
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm font-semibold text-slate-500">
                        No promoted incomplete orders yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o: any) => (
                      <tr key={o.id} className="transition-colors hover:bg-indigo-50/60">
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-mono text-sm font-extrabold text-slate-900">{o.order_no}</p>
                          <FulfillmentChips o={o} />
                          <ResendEventChips events={o.email_events ?? null} />

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
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          <AdminIncompleteCheckouts search={search} />
        </div>

      ) : (
        <div className="space-y-3">
          {isProcessing && selected.size > 0 && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 shadow-lg ring-1 ring-emerald-100">
              <span className="text-xs font-extrabold text-slate-900">
                {selected.size} selected
              </span>
              {selectionHasNonPhysical && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                  Selection contains digital / online-book orders — deselect those to send RTS.
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={openBulkRTS}
                  disabled={selectionHasNonPhysical || selectedList.filter((o: any) => o.has_physical).length === 0}
                  title={
                    selectionHasNonPhysical
                      ? "Deselect digital / online-book orders first"
                      : "Send selected physical orders to Steadfast"
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition-all",
                    "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
                    "disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500",
                  )}
                >
                  <Truck className="size-3.5" />
                  Send {selectedList.filter((o: any) => o.has_physical).length} to Steadfast (RTS)
                </button>
              </div>
            </div>
          )}
        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-indigo-100/70 to-sky-100/70 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/70">
                <tr>
                  {isProcessing && (
                    <th className="w-10 px-3 py-3">
                      <button
                        type="button"
                        onClick={toggleSelectAllPhysical}
                        disabled={selectablePhysicalIds.length === 0}
                        title={
                          selectablePhysicalIds.length === 0
                            ? "No physical orders on this page"
                            : allPhysicalSelected
                              ? "Deselect all physical orders"
                              : "Select all physical orders"
                        }
                        className="grid size-5 place-items-center text-indigo-700 disabled:text-slate-300"
                      >
                        {allPhysicalSelected ? (
                          <CheckSquare className="size-4" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </th>
                  )}
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
                    <td colSpan={isProcessing ? 6 : 5} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-indigo-400" />
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={isProcessing ? 6 : 5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                      No orders in <span className="font-extrabold">{STATUS_LABEL[tab]}</span>.
                    </td>
                  </tr>
                ) : (
                  orders.map((o: any) => {
                    const failedRTS =
                      o.has_physical &&
                      !o.steadfast_consignment_id &&
                      !!o.steadfast_last_error &&
                      o.status === "processing";
                    const showSFCard = !!o.steadfast_consignment_id;
                    return (
                    <tr key={o.id} className="transition-colors hover:bg-indigo-50/60">
                      {isProcessing && (
                        <td className="px-3 py-3.5 align-top">
                          <button
                            type="button"
                            onClick={() => toggleSelect(o.id)}
                            className={cn(
                              "grid size-5 place-items-center rounded",
                              o.has_physical ? "text-indigo-700" : "text-slate-300 cursor-not-allowed",
                            )}
                            title={
                              o.has_physical
                                ? "Toggle selection"
                                : "Digital-only order cannot be sent to Steadfast"
                            }
                          >
                            {selected.has(o.id) ? (
                              <CheckSquare className="size-4" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3.5 align-top">
                        <p className="font-mono text-sm font-extrabold text-slate-900">{o.order_no}</p>
                        <FulfillmentChips o={o} />
                        <ResendEventChips events={o.email_events ?? null} />
                        {o.has_physical && (
                          <SteadfastEventChips
                            orderId={o.id}
                            fallbackStatus={o.steadfast_delivery_status ?? o.steadfast_status ?? null}
                          />
                        )}
                        {failedRTS && <FailedRTSBadge />}
                        {showSFCard && (
                          <SteadfastTrackingCard
                            consignmentId={o.steadfast_consignment_id}
                            trackingCode={o.steadfast_tracking_code}
                          />
                        )}
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
                  );})
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {!isIncomplete && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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
