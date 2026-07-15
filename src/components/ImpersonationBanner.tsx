import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { endImpersonation, getImpersonationState } from "@/lib/impersonation";

export function ImpersonationBanner() {
  const router = useRouter();
  const [state, setState] = useState(() => getImpersonationState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setState(getImpersonationState());
    window.addEventListener("impersonation:changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("impersonation:changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!state) return null;

  async function exit() {
    setBusy(true);
    try {
      const res = await endImpersonation();
      toast.success("Returned to your admin account");
      router.navigate({ to: res?.redirectTo ?? "/workspace" });
    } catch (e) {
      toast.error("Exit failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-[60] w-full border-b border-amber-400 bg-amber-100 px-4 py-2 text-amber-900 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4" />
          <span>
            Impersonating <span className="font-bold">{state.target_label}</span>
            <span className="ml-1 font-normal text-amber-700">({state.target_email})</span>
          </span>
        </div>
        <button
          type="button"
          onClick={exit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
          Exit impersonation
        </button>
      </div>
    </div>
  );
}
