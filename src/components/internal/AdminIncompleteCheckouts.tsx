import { useEffect, useState } from "react";
import { Pagination } from "@/components/internal/Pagination";

import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  Mail,
  Fingerprint,
  Globe,
  MapPin,
  Package as PackageIcon,
  RefreshCw,
  Trash2,
  ChevronDown,
  Eye,
} from "lucide-react";
import {
  listAdminIncompleteCheckouts,
  deleteIncompleteCheckout,
  promoteIncompleteCheckoutToOrder,
} from "@/lib/orders.functions";
import { formatDhakaDateTime } from "@/lib/orders";
import { formatBDTEn } from "@/lib/format";
import { AdminOrderDrawer } from "@/components/internal/AdminOrderDrawer";
import { cn } from "@/lib/utils";

type Attempt = {
  at: string;
  ip?: string | null;
  fingerprint?: string | null;
  user_agent?: string | null;
  outcome?: string | null;
  gateway_ref?: string | null;
};
type Row = {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  division: string | null;
  district: string | null;
  thana: string | null;
  address_line: string | null;
  cart: any[];
  subtotal_bdt: number;
  shipping_bdt: number;
  total_bdt: number;
  last_ip: string | null;
  last_user_agent: string | null;
  last_fingerprint: string | null;
  last_outcome: string | null;
  attempts: Attempt[];
  attempt_count: number;
  first_attempt_at: string;
  last_attempt_at: string;
};

const OUTCOME_STYLE: Record<string, string> = {
  abandoned: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-100 text-rose-800",
  failed: "bg-red-100 text-red-800",
  timeout: "bg-orange-100 text-orange-800",
};

function OutcomeBadge({ outcome }: { outcome?: string | null }) {
  const key = (outcome || "abandoned").toLowerCase();
  const cls = OUTCOME_STYLE[key] ?? OUTCOME_STYLE.abandoned;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider", cls)}>
      {key}
    </span>
  );
}


export function AdminIncompleteCheckouts({ search }: { search: string }) {
  const fetchList = useServerFn(listAdminIncompleteCheckouts);
  const del = useServerFn(deleteIncompleteCheckout);
  const promote = useServerFn(promoteIncompleteCheckoutToOrder);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const offset = (page - 1) * pageSize;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-incomplete", search, page, pageSize],
    queryFn: () =>
      fetchList({ data: { search: search || undefined, limit: pageSize, offset } }),
  });


  async function remove(id: string) {
    if (!(await confirmDialog({ variant: "danger", description: "Delete this incomplete checkout record?" }))) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  }

  async function view(id: string) {
    setPromotingId(id);
    try {
      const res = await promote({ data: { id } });
      setOpenOrderId(res.id);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to open");
    } finally {
      setPromotingId(null);
    }
  }


  const rows = (data ?? []) as Row[];

  return (
    <>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span>{rows.length} incomplete checkout{rows.length === 1 ? "" : "s"}</span>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
        >
          <RefreshCw className={cn("size-3", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
          No incomplete checkouts captured.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const isOpen = expandedId === r.id;
            return (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{r.customer_name || "(no name)"}</p>
                      <a
                        href={`tel:${r.customer_phone}`}
                        className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 font-mono text-xs font-bold text-brand hover:bg-brand/20"
                      >
                        <Phone className="size-3" />
                        {r.customer_phone}
                      </a>
                      {r.customer_email && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                          <Mail className="size-3" />
                          {r.customer_email}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                        {r.attempt_count} attempt{r.attempt_count === 1 ? "" : "s"}
                      </span>
                      <OutcomeBadge outcome={r.last_outcome} />

                    </div>

                    {(r.address_line || r.thana || r.district || r.division) && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-600">
                        <MapPin className="mt-0.5 size-3 shrink-0" />
                        <span>
                          {[r.address_line, r.thana, r.district, r.division].filter(Boolean).join(", ")}
                        </span>
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-500">
                      <span>First: {formatDhakaDateTime(r.first_attempt_at)}</span>
                      <span>Last: {formatDhakaDateTime(r.last_attempt_at)}</span>
                      <span>Total: <span className="font-mono text-slate-800">{formatBDTEn(Number(r.total_bdt))}</span></span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(r.cart ?? []).map((c: any, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                        >
                          <PackageIcon className="size-3 text-slate-400" />
                          {c.title} <span className="font-mono text-slate-500">×{c.quantity}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      onClick={() => view(r.id)}
                      disabled={promotingId === r.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm hover:bg-brand/90 disabled:opacity-60"
                    >
                      {promotingId === r.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                      View
                    </button>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
                      {isOpen ? "Hide" : "Show"} attempts
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Attempts ({r.attempts?.length ?? 0})
                    </p>
                    <ul className="space-y-1">
                      {(r.attempts ?? []).slice().reverse().map((a, idx) => (
                        <li
                          key={idx}
                          className="flex flex-wrap items-center gap-3 rounded-md bg-white px-2 py-1 text-[11px]"
                        >
                          <span className="font-mono font-bold text-slate-800">
                            {formatDhakaDateTime(a.at)}
                          </span>
                          <OutcomeBadge outcome={a.outcome} />
                          {a.gateway_ref && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                              ref: {a.gateway_ref}
                            </span>
                          )}
                          {a.ip && (
                            <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                              <Globe className="size-3" />
                              {a.ip}
                            </span>
                          )}
                          {a.fingerprint && (
                            <span className="inline-flex max-w-[220px] items-center gap-1 truncate font-mono text-slate-500">
                              <Fingerprint className="size-3 shrink-0" />
                              <span className="truncate">{a.fingerprint}</span>
                            </span>
                          )}
                        </li>

                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
      {openOrderId && (
        <AdminOrderDrawer
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
          onChanged={() => refetch()}
        />
      )}
    </>
  );
}
