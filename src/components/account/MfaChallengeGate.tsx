/**
 * MFA (TOTP) challenge gate.
 *
 * Watches Supabase auth level. If the current session is aal1 but the user
 * has a verified TOTP factor (nextLevel === 'aal2'), presents a blocking
 * modal that challenges + verifies until session becomes aal2, OR the user
 * cancels (which signs them out).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toEnglishDigits } from "@/lib/input-filter";

export function MfaChallengeGate() {
  const [need, setNeed] = useState<null | { factorId: string }>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const checkingRef = useRef(false);

  async function check() {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setNeed(null);
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") {
        setNeed(null);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (totp) setNeed({ factorId: totp.id });
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "MFA_CHALLENGE_VERIFIED") {
        window.setTimeout(() => void check(), 100);
      }
      if (event === "SIGNED_OUT") setNeed(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function verify() {
    if (!need) return;
    if (code.length !== 6) return toast.error("৬ ডিজিটের কোড দিন");
    setBusy(true);
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: need.factorId,
      });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: need.factorId,
        challengeId: chal.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("2FA সফল");
      setCode("");
      setNeed(null);
    } catch (e) {
      toast.error("কোড ভুল: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setNeed(null);
    setCode("");
    await supabase.auth.signOut();
  }

  useEffect(() => {
    if (!need) return;
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, [need]);

  if (!need) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4" style={{ height: "100dvh" }}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-brand" />
          টু-ফ্যাক্টর কোড
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার Authenticator অ্যাপ থেকে ৬-ডিজিট কোড দিন।
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          className="mt-4 w-full rounded-md border border-input bg-background px-3 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-brand"
          placeholder="000000"
        />
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.length !== 6}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            ভেরিফাই
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            <X className="size-3.5" /> বাতিল
          </button>
        </div>
      </div>
    </div>
  );
}
