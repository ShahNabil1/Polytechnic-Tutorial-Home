import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Steadfast brand mark — pared-down truck-in-square glyph used as an inline
// identifier so admins recognize these chips as auto-updates from Steadfast
// (as opposed to Resend for email).
export function SteadfastLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Steadfast"
    >
      <rect width="24" height="24" rx="5" fill="currentColor" />
      <path
        d="M4 9.2a1 1 0 0 1 1-1h7.6c.55 0 1 .45 1 1v5.5H4V9.2Zm10.6.5h3l2.4 3v2h-5.4V9.7Zm-8.1 6.6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill="#fff"
      />
    </svg>
  );
}

export type SteadfastEvent = {
  id: string;
  status: string;
  received_at: string;
  consignment_id: string | null;
  tracking_code: string | null;
};

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

const STATUS_STYLE: Record<string, string> = {
  in_review: "bg-slate-50 text-slate-700 ring-slate-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  hold: "bg-amber-50 text-amber-800 ring-amber-200",
  in_transit: "bg-sky-50 text-sky-700 ring-sky-200",
  shipped: "bg-sky-50 text-sky-700 ring-sky-200",
  delivered_approval_pending: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partial_delivered_approval_pending: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partial_delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled_approval_pending: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  unknown_approval_pending: "bg-slate-50 text-slate-600 ring-slate-200",
  unknown: "bg-slate-50 text-slate-600 ring-slate-200",
  return_requested: "bg-orange-50 text-orange-700 ring-orange-200",
  return_in_transit: "bg-orange-50 text-orange-700 ring-orange-200",
  returned: "bg-orange-50 text-orange-700 ring-orange-200",
  delivery_failed: "bg-rose-50 text-rose-700 ring-rose-200",
};

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render every distinct courier status that has been received for an order,
 * newest last. Live-updates via realtime on `steadfast_status_events`.
 */
export function SteadfastEventChips({
  orderId,
  fallbackStatus,
}: {
  orderId: string;
  fallbackStatus?: string | null;
}) {
  const { data, refetch } = useQuery({
    queryKey: ["steadfast-events", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("steadfast_status_events" as never)
        .select("id, status, received_at, consignment_id, tracking_code")
        .eq("order_id", orderId)
        .order("received_at", { ascending: true });
      return (data ?? []) as unknown as SteadfastEvent[];
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`sf-events-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "steadfast_status_events", filter: `order_id=eq.${orderId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, refetch]);

  const events = data ?? [];
  // Deduplicate by status (keep first-seen time)
  const seen = new Map<string, SteadfastEvent>();
  for (const e of events) {
    if (!seen.has(e.status)) seen.set(e.status, e);
  }
  let chips = Array.from(seen.values());
  if (chips.length === 0 && fallbackStatus) {
    chips = [
      {
        id: "fallback",
        status: fallbackStatus,
        received_at: "",
        consignment_id: null,
        tracking_code: null,
      },
    ];
  }
  if (chips.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {chips.map((c) => (
        <span
          key={c.id}
          title={`Steadfast · ${statusLabel(c.status)}${c.received_at ? ` · ${fmt(c.received_at)}` : ""}`}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
            STATUS_STYLE[c.status] ?? "bg-slate-50 text-slate-700 ring-slate-200",
          )}
        >
          <SteadfastLogo className="size-3 text-emerald-700" />
          {statusLabel(c.status)}
        </span>
      ))}
    </div>
  );
}

/** Copy-to-clipboard block for consignment id + tracking code, shown on RTS+ cards. */
export function SteadfastTrackingCard({
  consignmentId,
  trackingCode,
}: {
  consignmentId: string | null | undefined;
  trackingCode: string | null | undefined;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!consignmentId && !trackingCode) return null;

  function copy(value: string, label: string) {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(label);
        toast.success(`${label} copied`);
        setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
      })
      .catch(() => toast.error("Copy failed"));
  }

  return (
    <div className="mt-2 inline-flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-[11px]">
      <div className="mb-0.5 flex items-center gap-1.5 text-emerald-800">
        <SteadfastLogo className="size-3.5 text-emerald-700" />
        <span className="font-extrabold uppercase tracking-wider">Steadfast</span>
      </div>
      {consignmentId && (
        <button
          type="button"
          onClick={() => copy(String(consignmentId), "Consignment ID")}
          className="group inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left font-mono text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
          title="Click to copy consignment ID"
        >
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">Consignment</span>
          <span>{consignmentId}</span>
          {copied === "Consignment ID" ? (
            <CheckCircle2 className="size-3 text-emerald-600" />
          ) : (
            <Copy className="size-3 text-emerald-600 opacity-60 group-hover:opacity-100" />
          )}
        </button>
      )}
      {trackingCode && (
        <button
          type="button"
          onClick={() => copy(String(trackingCode), "Tracking code")}
          className="group inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left font-mono text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
          title="Click to copy tracking code"
        >
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">Tracking</span>
          <span>{trackingCode}</span>
          {copied === "Tracking code" ? (
            <CheckCircle2 className="size-3 text-emerald-600" />
          ) : (
            <Copy className="size-3 text-emerald-600 opacity-60 group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  );
}

/** Compact "Failed RTS" pill for the card list. */
export function FailedRTSBadge() {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-800 ring-1 ring-rose-300">
      <Truck className="size-3" /> Failed RTS
    </span>
  );
}
