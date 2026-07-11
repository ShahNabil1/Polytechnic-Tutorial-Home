import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Ticket, X, Loader2, Check } from "lucide-react";
import { validateCoupon } from "@/lib/coupons.functions";
import { useCoupon } from "@/lib/coupon-store";
import { formatBDT } from "@/lib/format";
import { cn } from "@/lib/utils";

const REASON_MSG: Record<string, string> = {
  not_found: "এই কোডে কোনো কুপন নেই।",
  inactive: "কুপনটি এখন সক্রিয় নয়।",
  expired: "কুপনের মেয়াদ শেষ।",
  not_started: "কুপনটি এখনো চালু হয়নি।",
  min_spend: "সর্বনিম্ন কেনাকাটার শর্ত পূরণ হয়নি।",
  max_uses: "কুপনের সর্বোচ্চ ব্যবহার শেষ।",
  max_uses_customer: "আপনি এই কুপন ইতোমধ্যে ব্যবহার করেছেন।",
  not_applicable: "এই কার্টের কোনো প্রোডাক্টের সাথে কুপনটি প্রযোজ্য নয়।",
  error: "কুপন যাচাই করতে সমস্যা হয়েছে।",
};

export function CouponBlock({
  subtotal,
  productIds,
  phone,
}: {
  subtotal: number;
  productIds: string[];
  phone: string;
}) {
  const applied = useCoupon((s) => s.applied);
  const setApplied = useCoupon((s) => s.set);
  const clearApplied = useCoupon((s) => s.clear);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validateFn = useServerFn(validateCoupon);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await validateFn({
        data: {
          code: code.trim(),
          subtotal,
          productIds,
          phone: phone || null,
          scope: "shop",
        },
      });
      if (!res.ok || !res.couponId) {
        setError(REASON_MSG[res.reason || "error"] || "কুপন প্রযোজ্য নয়।");
        return;
      }
      setApplied({
        code: res.code!,
        name: res.name!,
        discount: res.discount,
        couponId: res.couponId,
        discountType: res.discountType!,
      });
      setCode("");
    } catch (e: any) {
      setError(e?.message || "কুপন যাচাই ব্যর্থ।");
    } finally {
      setBusy(false);
    }
  }

  // If cart changes make the applied coupon invalid (subtotal drop, product change),
  // re-validate silently and drop it if it no longer applies.
  // (Kept minimal — validated again server-side on order create.)

  if (applied) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-600 text-white">
              <Check className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-emerald-800">
                {applied.code} <span className="font-normal text-emerald-700">— {applied.name}</span>
              </div>
              <div className="text-[11.5px] font-semibold text-emerald-700">
                Discount −{formatBDT(applied.discount)}
              </div>
            </div>
          </div>
          <button
            onClick={() => clearApplied()}
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="Remove coupon"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Ticket className="size-4 text-brand" /> Promo / Coupon code
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          placeholder="e.g. SAVE20"
          className="input font-mono uppercase"
          maxLength={40}
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || !code.trim()}
          className={cn(
            "shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-60",
            "inline-flex items-center gap-1.5",
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Apply
        </button>
      </div>
      {error && (
        <div className="mt-2 text-xs font-semibold text-destructive">{error}</div>
      )}
    </div>
  );
}
