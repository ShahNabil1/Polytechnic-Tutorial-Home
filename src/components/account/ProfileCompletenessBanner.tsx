import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { FIELD_LABELS_BN } from "@/lib/profile";

export function ProfileCompletenessBanner({
  missing,
  showOnProfilePage,
}: {
  missing: string[];
  showOnProfilePage?: boolean;
}) {
  if (missing.length === 0) return null;

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-50 via-amber-100/80 to-orange-50 shadow-sm dark:border-amber-500/30 dark:from-amber-950/60 dark:via-amber-900/40 dark:to-orange-950/50">
      <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-400/10" />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm ring-4 ring-amber-500/15">
            <AlertTriangle className="size-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-amber-950 dark:text-amber-50">
              প্রোফাইল অসম্পূর্ণ
            </div>
            <div className="mt-1 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              অ্যাকাউন্টের সব সুবিধা পেতে নিচের তথ্যগুলো পূরণ করুন:
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missing.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center rounded-full border border-amber-500/40 bg-white/70 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/60 dark:text-amber-100"
                >
                  {FIELD_LABELS_BN[f] ?? f}
                </span>
              ))}
            </div>
          </div>
        </div>
        {!showOnProfilePage && (
          <Link
            to="/sdash/profile"
            className="group inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-center"
          >
            এখনই পূরণ করুন
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
