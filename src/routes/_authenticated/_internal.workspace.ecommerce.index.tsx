import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  getEcommerceDashboardStats,
  type EcomDashboardStats,
  type EcomDashboardRecentOrder,
} from "@/lib/orders.functions";
import { STATUS_LABEL, STATUS_STYLE, type OrderStatus } from "@/lib/orders";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/")({
  head: () => ({
    meta: [
      { title: "E-Commerce Dashboard — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EcommerceDashboard,
});

type StatCardDef = {
  label: string;
  icon: LucideIcon;
  accent: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  hint: string;
};

const bdt = (n: number) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const pct = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

function buildStats(d: EcomDashboardStats | undefined): StatCardDef[] {
  return [
    {
      label: "Today's Sales",
      icon: DollarSign,
      accent: "from-emerald-500/20 to-teal-500/5 text-emerald-600",
      value: d ? `৳ ${bdt(d.today_sales_bdt)}` : "৳ 0",
      delta: d ? pct(d.today_sales_delta_pct) : "—",
      trend: !d ? "flat" : (d.today_sales_delta_pct ?? 0) >= 0 ? "up" : "down",
      hint: "vs. yesterday",
    },
    {
      label: "Pending Orders",
      icon: ShoppingCart,
      accent: "from-amber-500/20 to-orange-500/5 text-amber-600",
      value: d ? String(d.pending_orders) : "0",
      delta: d ? `${d.pending_orders_new_today} new` : "0 new",
      trend: "up",
      hint: "today",
    },
    {
      label: "Products In Stock",
      icon: Package,
      accent: "from-indigo-500/20 to-violet-500/5 text-indigo-600",
      value: d ? String(d.products_in_stock) : "0",
      delta: d ? `${d.products_low_stock} low` : "0 low",
      trend: d && d.products_low_stock > 0 ? "down" : "up",
      hint: "≤ 5 units",
    },
    {
      label: "Conversion Rate",
      icon: TrendingUp,
      accent: "from-fuchsia-500/20 to-pink-500/5 text-fuchsia-600",
      value: d ? `${d.conversion_rate_pct.toFixed(1)}%` : "0.0%",
      delta: d ? pct(d.conversion_rate_delta_pct) : "—",
      trend: !d ? "flat" : (d.conversion_rate_delta_pct ?? 0) >= 0 ? "up" : "down",
      hint: "last 30d",
    },
  ];
}

function EcommerceDashboard() {
  const fetchStats = useServerFn(getEcommerceDashboardStats);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ecommerce-dashboard-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const stats = buildStats(data);
  const recent = data?.recent_orders ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
            E-Commerce
          </p>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Storefront Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">
            Real-time overview of your online store — sales, orders and inventory at a glance.
          </p>
        </div>
        <Link
          to="/workspace/ecommerce/orders"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
        >
          View Orders
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Failed to load stats.{" "}
          <button type="button" onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${s.accent}`}
              />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {s.label}
                  </p>
                  {isLoading ? (
                    <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-200" />
                  ) : (
                    <p className="mt-2 font-display text-3xl font-black tracking-tight text-slate-900">
                      {s.value}
                    </p>
                  )}
                </div>
                <div className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${s.accent}`}>
                  <Icon className="size-5" />
                </div>
              </div>
              <div className="relative mt-4 flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={
                    s.trend === "down"
                      ? "rounded-md bg-red-50 px-1.5 py-0.5 text-red-700"
                      : s.trend === "flat"
                        ? "rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600"
                        : "rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
                  }
                >
                  {s.delta}
                </span>
                <span className="text-slate-500">{s.hint}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
              Recent Orders
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Latest activity from your storefront
            </p>
          </div>
          <Link
            to="/workspace/ecommerce/orders"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open all orders"
          >
            <MoreHorizontal className="size-5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    </td>
                  </tr>
                ))}
              {!isLoading &&
                recent.map((o: EcomDashboardRecentOrder) => {
                  const status = o.status as OrderStatus;
                  const style =
                    STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700 ring-slate-300";
                  const label = STATUS_LABEL[status] ?? o.status;
                  return (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">
                        {o.order_no}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {o.customer_name || "—"}
                        </div>
                        <div className="text-xs text-slate-500">{o.customer_phone || ""}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        ৳ {bdt(Number(o.total_bdt || 0))}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${style}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && recent.length === 0 && (
          <div className="flex items-center justify-center border-t border-slate-100 px-6 py-6">
            <p className="text-xs font-semibold text-slate-500">
              No orders yet — this table will populate as your store goes live.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
