import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { checkBlocklistPublic } from "@/lib/orders.functions";
import { computeFingerprint } from "@/lib/fingerprint";

export function BlocklistGate({ children }: { children: React.ReactNode }) {
  const check = useServerFn(checkBlocklistPublic);
  const [state, setState] = useState<
    { status: "checking" } | { status: "ok" } | { status: "blocked"; reason: string | null }
  >({ status: "checking" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fp = await computeFingerprint();
        const res = await check({ data: { fingerprint: fp } });
        if (!alive) return;
        if (res.blocked) setState({ status: "blocked", reason: res.reason ?? null });
        else setState({ status: "ok" });
      } catch {
        // If the check fails, don't lock users out.
        if (alive) setState({ status: "ok" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [check]);

  if (state.status === "blocked") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-rose-500/10 text-rose-400">
            <ShieldAlert className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-white">Access Blocked</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            আপনার ডিভাইস / আইপি থেকে এই সাইটে প্রবেশ সীমাবদ্ধ করা হয়েছে।
          </p>
          {state.reason && (
            <p className="mt-3 rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-slate-400">
              Reason: {state.reason}
            </p>
          )}
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
