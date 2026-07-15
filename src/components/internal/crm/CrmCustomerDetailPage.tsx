import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Loader2, User as UserIcon, ShoppingBag, GraduationCap,
  TrendingUp, Calendar, Mail, Phone,
} from "lucide-react";
import { getCrmCustomer, type CrmCustomerDetail } from "@/lib/crm.functions";
import { CrmMessagingPanel } from "./CrmMessagingPanel";
import { CrmCartCard } from "./CrmCartCard";

function fmtBDT(n: number) {
  return `৳${Math.round(n).toLocaleString("en-BD")}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type Tab = "overview" | "messages" | "cart";

export function CrmCustomerDetailPage({ userId }: { userId: string }) {
  const router = useRouter();
  const getFn = useServerFn(getCrmCustomer);
  const [detail, setDetail] = useState<CrmCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getFn({ data: { user_id: userId } })
      .then((d) => !cancel && setDetail(d as CrmCustomerDetail))
      .catch((e) => !cancel && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [userId, getFn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading customer…
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button onClick={() => router.history.back()} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error || "Customer not found"}
        </div>
      </div>
    );
  }

  const lastOrderNo = detail.orders[0]?.order_no ?? null;
  const vars = {
    name: detail.full_name,
    phone: detail.phone,
    email: detail.email,
    last_order_no: lastOrderNo,
    ltv: Math.round(detail.ltv.total_spent),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.history.back()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${detail.segment === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}>
          {detail.segment === "active" ? "Active customer" : "Signed up · no purchase"}
        </span>
      </div>

      {/* Profile header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
          {detail.avatar_url ? (
            <img src={detail.avatar_url} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <UserIcon className="size-7" />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{detail.full_name || "Unnamed"}</h1>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {detail.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{detail.phone}</span>}
            {detail.email && <span className="flex items-center gap-1"><Mail className="size-3" />{detail.email}</span>}
            <span className="flex items-center gap-1"><Calendar className="size-3" />Joined {fmtDate(detail.signed_up_at)}</span>
          </div>
        </div>
      </div>

      {/* LTV cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={ShoppingBag} label="Orders" value={String(detail.ltv.order_count)} />
        <StatCard icon={TrendingUp} label="Lifetime spent" value={fmtBDT(detail.ltv.total_spent)} />
        <StatCard icon={TrendingUp} label="Avg order" value={fmtBDT(detail.ltv.avg_order_value)} />
        <StatCard icon={GraduationCap} label="Active courses" value={`${detail.ltv.active_enrollments}/${detail.ltv.total_enrollments}`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["overview", "messages", "cart"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Orders */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-semibold">Order history</h2>
              <p className="text-xs text-muted-foreground">First: {fmtDate(detail.ltv.first_order_at)} · Last: {fmtDate(detail.ltv.last_order_at)}</p>
            </header>
            {detail.orders.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No orders yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Order</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Payment</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detail.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link to="/workspace/ecommerce/orders" className="text-primary hover:underline">
                            {o.order_no}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-xs">{o.status}</td>
                        <td className="px-4 py-2 text-xs">{o.payment_status}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtBDT(o.total_bdt)}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Enrollments */}
          <section className="rounded-2xl border border-border bg-card">
            <header className="border-b border-border px-5 py-3">
              <h2 className="font-semibold">Course enrollments</h2>
            </header>
            {detail.enrollments.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No enrollments yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {detail.enrollments.map((e) => {
                  const expired = e.expires_at ? new Date(e.expires_at) < new Date() : false;
                  return (
                    <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div>
                        <p className="font-medium">{e.course_title || e.course_id}</p>
                        <p className="text-xs text-muted-foreground">
                          Granted {fmtDate(e.granted_at)} · {e.expires_at ? `Expires ${fmtDate(e.expires_at)}` : "No expiry"}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${expired ? "bg-slate-200 text-slate-600" : "bg-emerald-500/10 text-emerald-700"}`}>
                        {expired ? "Expired" : "Active"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "messages" && (
        <CrmMessagingPanel
          vars={vars}
          userId={detail.user_id}
          phone={detail.phone}
          email={detail.email}
        />
      )}

      {tab === "cart" && <CrmCartCard userId={detail.user_id} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
