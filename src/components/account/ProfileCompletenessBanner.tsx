import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { FIELD_LABELS_BN } from "@/lib/profile";

export function ProfileCompletenessBanner({
  missing,
  showOnProfilePage,
}: {
  missing: string[];
  showOnProfilePage?: boolean;
}) {
  if (missing.length === 0) return null;
  const labels = missing.map((f) => FIELD_LABELS_BN[f] ?? f).join(", ");

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div>
          <div className="font-medium text-amber-200">প্রোফাইল অসম্পূর্ণ</div>
          <div className="mt-0.5 text-amber-100/90">
            অনুগ্রহ করে এই তথ্যগুলো পূরণ করুন: <span className="font-medium">{labels}</span>
          </div>
        </div>
      </div>
      {!showOnProfilePage && (
        <Link
          to="/sdash/profile"
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400"
        >
          এখনই পূরণ করুন
        </Link>
      )}
    </div>
  );
}
