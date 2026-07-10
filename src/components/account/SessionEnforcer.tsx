/**
 * Global session enforcer.
 *
 * - After sign-in (once per session), registers the session with the server.
 * - If user is already on 2 devices, shows a modal to pick which to kick.
 * - Every 60s heartbeats — if server says session was revoked, signs out.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerSession, pingSession, revokeSession } from "@/lib/sessions.functions";
import { toast } from "sonner";
import { Loader2, Monitor, LogOut } from "lucide-react";

type ChoiceSession = {
  id: string;
  device_label: string | null;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
};

type RegisterResult =
  | { status: "ok" }
  | { status: "choice"; sessions: ChoiceSession[] }
  | { status: "failed" };

type RegisterSessionCall = () => Promise<
  | { ok: true }
  | { ok: false; needsChoice: true; sessions: ChoiceSession[] }
  | { ok: false }
>;

async function tryRegister(registerSessionCall: RegisterSessionCall): Promise<RegisterResult> {
  try {
    const res = await registerSessionCall();
    if (res.ok) return { status: "ok" };
    if ("needsChoice" in res && res.needsChoice) {
      return { status: "choice", sessions: res.sessions };
    }
    return { status: "failed" };
  } catch (e) {
    console.error("registerSession failed", e);
    return { status: "failed" };
  }
}

export function SessionEnforcer() {
  const registerSessionFn = useServerFn(registerSession);
  const pingSessionFn = useServerFn(pingSession);
  const revokeSessionFn = useServerFn(revokeSession);
  const [choice, setChoice] = useState<ChoiceSession[] | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const registeredForSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureRegistered() {
      const { data } = await supabase.auth.getSession();
      const sess = data.session;
      if (!sess) return;
      if (registeredForSessionRef.current === sess.access_token) return;
      const result = await tryRegister(() => registerSessionFn());
      if (cancelled) return;
      if (result.status === "ok") {
        registeredForSessionRef.current = sess.access_token;
        setChoice(null);
      } else if (result.status === "choice") {
        setChoice(result.sessions);
      }
    }

    ensureRegistered();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          void ensureRegistered();
        }, 0);
      }
      if (event === "SIGNED_OUT") registeredForSessionRef.current = null;
    });

    // Heartbeat every 60s
    const heartbeat = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        const res = await pingSessionFn();
        if (!res.alive) {
          if (!registeredForSessionRef.current) {
            await ensureRegistered();
            return;
          }
          toast.error("অন্য ডিভাইস থেকে সাইন আউট করা হয়েছে");
          await supabase.auth.signOut();
        }
      } catch {
        /* transient network — ignore */
      }
    }, 60000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearInterval(heartbeat);
    };
  }, []);

  async function handlePick(id: string) {
    setKicking(id);
    try {
      await revokeSessionFn({ data: { id } });
      const result = await tryRegister(() => registerSessionFn());
      setChoice(result.status === "choice" ? result.sessions : null);
      if (result.status === "ok") toast.success("সাইন-ইন সম্পন্ন");
    } catch (e) {
      toast.error("সেশন কাটতে পারলাম না: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setKicking(null);
    }
  }

  async function handleCancel() {
    setChoice(null);
    await supabase.auth.signOut();
  }

  if (!choice) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">২ ডিভাইসের সীমা</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনি ইতোমধ্যে ২ ডিভাইসে সাইন-ইন আছেন। এই ডিভাইসে সাইন-ইন করতে হলে
          একটা পুরানো সেশন থেকে সাইন আউট করে দিন।
        </p>

        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {choice.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <Monitor className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.device_label || "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    IP: {s.ip || "unknown"} · সর্বশেষ {new Date(s.last_seen_at).toLocaleString("bn-BD")}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePick(s.id)}
                disabled={kicking !== null}
                className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              >
                {kicking === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                সাইন আউট
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleCancel}
          className="mt-4 w-full rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
        >
          বাতিল করে সাইন আউট
        </button>
      </div>
    </div>
  );
}
