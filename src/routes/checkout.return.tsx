import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, XCircle, Clock, RotateCcw } from "lucide-react";
import { z } from "zod";
import {
  readStashedSnapshot,
  clearStashedSnapshot,
  recordCheckoutOutcome,
  type CheckoutOutcome,
} from "@/lib/incomplete-checkout-client";

const searchSchema = z.object({
  status: z.enum(["cancelled", "failed", "timeout", "pending"]).optional(),
  ref: z.string().max(120).optional(),
});

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Payment Return — Polytechnic Tutorial Home" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutReturnPage,
});

const COPY: Record<
  CheckoutOutcome,
  { title: string; body: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  cancelled: {
    title: "Payment cancelled",
    body: "You cancelled the payment before it completed. Your order was not placed.",
    icon: XCircle,
    tone: "text-red-600",
  },
  failed: {
    title: "Payment failed",
    body: "The payment gateway reported a failure. Your order was not placed. You can retry now or use a different method.",
    icon: AlertTriangle,
    tone: "text-red-600",
  },
  timeout: {
    title: "Payment timed out",
    body: "We did not receive a response from the payment gateway in time. Your order was not placed.",
    icon: Clock,
    tone: "text-amber-600",
  },
  pending: {
    title: "Payment pending",
    body: "The payment is still being processed by the gateway. Please check back in a moment.",
    icon: Clock,
    tone: "text-amber-600",
  },
  abandoned: {
    title: "Checkout abandoned",
    body: "Your checkout was not completed.",
    icon: AlertTriangle,
    tone: "text-slate-600",
  },
};

function CheckoutReturnPage() {
  const search = useSearch({ from: "/checkout/return" });
  const status = (search.status ?? "cancelled") as CheckoutOutcome;
  const ref = search.ref;
  const [recorded, setRecorded] = useState<"idle" | "ok" | "skipped" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = readStashedSnapshot();
      if (!snap) {
        setRecorded("skipped");
        return;
      }
      const r = await recordCheckoutOutcome(snap, status, ref);
      if (cancelled) return;
      setRecorded(r.ok ? "ok" : "error");
      // Keep pending snapshot around so a later terminal outcome can still be recorded.
      if (status !== "pending" && r.ok) clearStashedSnapshot();
    })();
    return () => {
      cancelled = true;
    };
  }, [status, ref]);

  const meta = COPY[status] ?? COPY.cancelled;
  const Icon = meta.icon;

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Icon className={`mx-auto h-14 w-14 ${meta.tone}`} />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">{meta.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{meta.body}</p>
        {ref ? (
          <p className="mt-2 text-xs text-slate-400">Gateway reference: {ref}</p>
        ) : null}
        <p className="mt-4 text-xs text-slate-400">
          {recorded === "ok" && "Attempt recorded."}
          {recorded === "skipped" && "No checkout details found to record."}
          {recorded === "error" && "Could not record this attempt."}
          {recorded === "idle" && "Recording attempt…"}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/checkout"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Retry checkout
          </Link>
          <Link
            to="/"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
