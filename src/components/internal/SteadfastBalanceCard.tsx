import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, RefreshCw } from "lucide-react";
import { getSteadfastBalance } from "@/lib/steadfast.functions";

export function SteadfastBalanceCard() {
  const call = useServerFn(getSteadfastBalance);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: number; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      const r = await call();
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const balance =
    result && typeof result.data === "object" && result.data && "data" in result.data
      ? (result.data as { data?: { current_balance?: number } }).data?.current_balance
      : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/5 text-emerald-600">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Steadfast Balance
            </p>
            <p className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900">
              {balance !== undefined ? `৳ ${balance}` : "—"}
            </p>
            {result && (
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Worker status: {result.status}
              </p>
            )}
            {error && (
              <p className="mt-1 max-w-md break-words text-[11px] font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Check Balance
        </button>
      </div>
    </div>
  );
}
