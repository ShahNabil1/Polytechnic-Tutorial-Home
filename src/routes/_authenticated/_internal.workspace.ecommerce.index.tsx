import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { SteadfastBalanceCard } from "@/components/internal/SteadfastBalanceCard";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/")({
  head: () => ({
    meta: [
      { title: "E-Commerce Dashboard — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EcommerceDashboard,
});

type Stat = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: LucideIcon;
  accent: string;
};

const STATS: Stat[] = [
  {
    label: "Today's Sales",
    value: "৳ 0",
    delta: "+0.0%",
    trend: "up",
    icon: DollarSign,
    accent: "from-emerald-500/20 to-teal-500/5 text-emerald-600",
  },
  {
    label: "Pending Orders",
    value: "0",
    delta: "0 new",
    trend: "up",
    icon: ShoppingCart,
    accent: "from-amber-500/20 to-orange-500/5 text-amber-600",
  },
  {
    label: "Products In Stock",
    value: "0",
    delta: "0 low",
    trend: "up",
    icon: Package,
    accent: "from-indigo-500/20 to-violet-500/5 text-indigo-600",
  },
  {
    label: "Conversion Rate",
    value: "0.0%",
    delta: "+0.0%",
    trend: "up",
    icon: TrendingUp,
    accent: "from-fuchsia-500/20 to-pink-500/5 text-fuchsia-600",
  },
];

function EcommerceDashboard() {
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
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 opacity-60"
        >
          New Order
          <ArrowUpRight className="size-4" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => {
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
                  <p className="mt-2 font-display text-3xl font-black tracking-tight text-slate-900">
                    {s.value}
                  </p>
                </div>
                <div className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${s.accent}`}>
                  <Icon className="size-5" />
                </div>
              </div>
              <div className="relative mt-4 flex items-center gap-1.5 text-xs font-bold">
                <span
                  className={
                    s.trend === "up"
                      ? "rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
                      : "rounded-md bg-red-50 px-1.5 py-0.5 text-red-700"
                  }
                >
                  {s.delta}
                </span>
                <span className="text-slate-500">vs. last period</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent orders skeleton table */}
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
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="More options"
          >
            <MoreHorizontal className="size-5" />
          </button>
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
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 animate-pulse rounded-full bg-slate-200" />
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    </div>
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
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center border-t border-slate-100 px-6 py-4">
          <p className="text-xs font-semibold text-slate-500">
            No orders yet — this table will populate as your store goes live.
          </p>
        </div>
      </div>
    </div>
  );
}
