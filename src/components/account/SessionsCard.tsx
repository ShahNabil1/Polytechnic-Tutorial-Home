import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, LogOut, Shield } from "lucide-react";
import { listMySessions, revokeSession } from "@/lib/sessions.functions";

type Session = Awaited<ReturnType<typeof listMySessions>>[number];

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}

export function SessionsCard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function refresh() {
    try {
      setSessions(await listMySessions());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  async function handleRevoke(id: string) {
    if (!confirm("এই সেশন থেকে সাইন আউট করবেন?")) return;
    setRevoking(id);
    try {
      await revokeSession({ data: { id } });
      toast.success("সেশন রিভোক হয়েছে");
      await refresh();
    } catch (e) {
      toast.error("রিভোক করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Shield className="size-4 text-brand" />
            Active sessions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            একসাথে সর্বোচ্চ ২ ডিভাইসে সাইন-ইন থাকতে পারবেন। ৩য় ডিভাইসে লগইন করলে
            একটা পুরানো সেশন কেটে দিতে হবে।
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {sessions.length}/2
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.device_label || "Unknown"}</span>
                    {s.is_current && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        এই ডিভাইস
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    IP: {s.ip || "unknown"} · সর্বশেষ {relTime(s.last_seen_at)}
                  </div>
                </div>
              </div>
              {!s.is_current && (
                <button
                  type="button"
                  onClick={() => handleRevoke(s.id)}
                  disabled={revoking === s.id}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                >
                  {revoking === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                  সাইন আউট
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
