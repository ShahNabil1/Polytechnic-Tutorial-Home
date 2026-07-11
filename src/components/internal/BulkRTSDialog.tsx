import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, CheckCircle2, XCircle, Truck } from "lucide-react";
import { bulkDispatchToSteadfast } from "@/lib/steadfast.functions";
import { cn } from "@/lib/utils";

export type BulkDispatchOrder = {
  id: string;
  order_no: string;
};

type Result = {
  orderId: string;
  orderNo: string;
  ok: boolean;
  error?: string;
  consignmentId?: string;
  trackingCode?: string;
};

/**
 * Progress modal for the Processing-tab bulk RTS action.
 * The server runs the chunked dispatch (10-at-a-time + 3 retries) in a single
 * call and returns per-order results; we render them here as a live-looking
 * progress bar so the operator can watch each invoice succeed / fail.
 */
export function BulkRTSDialog({
  open,
  orders,
  onClose,
  onDone,
}: {
  open: boolean;
  orders: BulkDispatchOrder[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const dispatchFn = useServerFn(bulkDispatchToSteadfast);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setStatus("idle");
      setResults([]);
      setErrorText(null);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus("running");
    setResults(
      orders.map((o) => ({ orderId: o.id, orderNo: o.order_no, ok: false, error: undefined })),
    );
    dispatchFn({ data: { orderIds: orders.map((o) => o.id), chunkSize: 10 } })
      .then((res) => {
        setResults(res.results as Result[]);
        setStatus("done");
        onDone?.();
      })
      .catch((err: any) => {
        setErrorText(err?.message ?? "Bulk dispatch failed");
        setStatus("error");
      });
  }, [open, orders, dispatchFn, onDone]);

  if (!open) return null;

  const total = orders.length;
  const done = results.filter((r) => r.ok || r.error).length;
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => r.error).length;
  const pct = status === "running" ? Math.min(95, (done / Math.max(total, 1)) * 100) : 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-emerald-700" />
            <p className="text-sm font-extrabold text-slate-900">Sending to Steadfast</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === "running"}
            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>
                {status === "running"
                  ? `Dispatching ${done}/${total}…`
                  : status === "done"
                    ? `Done · ${succeeded} succeeded · ${failed} failed`
                    : status === "error"
                      ? "Failed"
                      : "Preparing…"}
              </span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  status === "error"
                    ? "bg-rose-500"
                    : status === "done"
                      ? "bg-emerald-500"
                      : "bg-sky-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {errorText && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {errorText}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
            <ul className="divide-y divide-slate-200 text-xs">
              {results.map((r) => (
                <li key={r.orderId} className="flex items-start gap-2 px-3 py-2">
                  <span className="mt-0.5">
                    {r.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : r.error ? (
                      <XCircle className="size-4 text-rose-600" />
                    ) : (
                      <Loader2 className="size-4 animate-spin text-slate-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] font-bold text-slate-900">{r.orderNo}</p>
                    {r.ok && r.consignmentId && (
                      <p className="truncate font-mono text-[11px] text-emerald-700">
                        #{r.consignmentId}
                        {r.trackingCode ? ` · ${r.trackingCode}` : ""}
                      </p>
                    )}
                    {r.error && (
                      <p className="truncate text-[11px] font-semibold text-rose-700" title={r.error}>
                        {r.error}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={status === "running"}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "done" || status === "error" ? "Close" : "Please wait…"}
          </button>
        </div>
      </div>
    </div>
  );
}
