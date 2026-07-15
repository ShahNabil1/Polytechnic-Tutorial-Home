import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, User as UserIcon, Phone as PhoneIcon, Mail as MailIcon, ShoppingBag, GraduationCap, AlertCircle } from "lucide-react";
import {
  listCrmCustomers,
  listCrmGuestPurchased,
  listCrmIncompleteLeads,
  type CrmCustomerRow,
  type CrmGuestRow,
  type CrmIncompleteRow,
} from "@/lib/crm.functions";

type Kind = "customers" | "signed" | "guests" | "incomplete";

const KIND_META: Record<Kind, { title: string; empty: string }> = {
  customers: {
    title: "Customers — Signed up + purchased / enrolled",
    empty: "No active customers yet.",
  },
  signed: {
    title: "Signed up — No purchase / enrollment yet",
    empty: "No leads in this segment.",
  },
  guests: {
    title: "Guests — Purchased from shop without account",
    empty: "No guest purchases yet.",
  },
  incomplete: {
    title: "Incomplete leads — Didn't complete checkout",
    empty: "No incomplete leads.",
  },
};

function fmtBDT(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return `৳${v.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CrmListPage({ kind }: { kind: Kind }) {
  const listCustomers = useServerFn(listCrmCustomers);
  const listGuests = useServerFn(listCrmGuestPurchased);
  const listIncomplete = useServerFn(listCrmIncompleteLeads);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        let data: any[] = [];
        if (kind === "customers") {
          data = await listCustomers({ data: { segment: "active", search } as any });
        } else if (kind === "signed") {
          data = await listCustomers({ data: { segment: "signed_no_purchase", search } as any });
        } else if (kind === "guests") {
          data = await listGuests({ data: { search } as any });
        } else {
          data = await listIncomplete({ data: { search } as any });
        }
        if (!cancel) setRows(data ?? []);
      } catch {
        if (!cancel) setRows([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [kind, search, listCustomers, listGuests, listIncomplete]);

  const meta = KIND_META[kind];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name / phone / email…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">{meta.empty}</div>
        ) : kind === "customers" || kind === "signed" ? (
          <SignedTable rows={rows as CrmCustomerRow[]} />
        ) : kind === "guests" ? (
          <GuestTable rows={rows as CrmGuestRow[]} />
        ) : (
          <IncompleteTable rows={rows as CrmIncompleteRow[]} />
        )}
      </div>
    </div>
  );
}

function SignedTable({ rows }: { rows: CrmCustomerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-right">Orders</th>
            <th className="px-4 py-3 text-right">Spent</th>
            <th className="px-4 py-3 text-right">Courses</th>
            <th className="px-4 py-3 text-left">Signed up</th>
            <th className="px-4 py-3 text-left">Last order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.user_id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link
                  to="/workspace/crm/$id"
                  params={{ id: r.user_id }}
                  className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="size-4" />
                  </span>
                  <span className="truncate">{r.full_name || "Unnamed"}</span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col text-xs text-muted-foreground">
                  {r.phone && (
                    <span className="flex items-center gap-1"><PhoneIcon className="size-3" />{r.phone}</span>
                  )}
                  {r.email && (
                    <span className="flex items-center gap-1"><MailIcon className="size-3" />{r.email}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.order_count}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtBDT(r.total_spent)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3 text-muted-foreground" />{r.active_enrollments}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.signed_up_at)}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.last_order_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuestTable({ rows }: { rows: CrmGuestRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Phone</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-right">Orders</th>
            <th className="px-4 py-3 text-right">Spent</th>
            <th className="px-4 py-3 text-left">Last order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.phone} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium">
                  <span className="grid size-8 place-items-center rounded-full bg-amber-500/10 text-amber-600">
                    <ShoppingBag className="size-4" />
                  </span>
                  {r.name || "Guest"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{r.phone}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.email || "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.order_count}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtBDT(r.total_spent)}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.last_order_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncompleteTable({ rows }: { rows: CrmIncompleteRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Phone</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-right">Cart value</th>
            <th className="px-4 py-3 text-right">Attempts</th>
            <th className="px-4 py-3 text-left">Last outcome</th>
            <th className="px-4 py-3 text-left">Last attempt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium">
                  <span className="grid size-8 place-items-center rounded-full bg-rose-500/10 text-rose-600">
                    <AlertCircle className="size-4" />
                  </span>
                  {r.name || "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{r.phone}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.email || "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtBDT(r.total_bdt)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{r.attempt_count}</td>
              <td className="px-4 py-3 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.last_outcome}</span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.last_attempt_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
