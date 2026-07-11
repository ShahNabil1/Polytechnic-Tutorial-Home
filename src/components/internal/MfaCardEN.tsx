/**
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
 * English fork of MfaCard for internal (/workspace, /instructor) routes.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncMyPrimaryAuthEmail, updateMyInternalProfile } from "@/lib/internal-profile.functions";
import { toEnglishDigits } from "@/lib/input-filter";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

export function MfaCardEN() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<null | {
    factorId: string;
    qr: string;
    secret: string;
  }>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const updateProfile = useServerFn(updateMyInternalProfile);
  const syncPrimaryEmail = useServerFn(syncMyPrimaryAuthEmail);

  async function loadFactors() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error("Failed to load MFA: " + error.message);
      setLoading(false);
      return;
    }
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  useEffect(() => {
    loadFactors();
  }, []);

  const verified = factors.some((f) => f.status === "verified");

  async function startEnroll() {
    setBusy(true);
    try {
      const syncResult = await syncPrimaryEmail({ data: undefined as never });
      if (!syncResult.ok) {
        throw new Error("No linked email found on this account. Please link a Google or email account first.");
      }
      for (const f of factors.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `TOTP-${Date.now()}`,
        issuer: "Polytechnic Tutorial",
      });
      if (error) throw error;
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      const err = e as { message?: string };
      const raw = err?.message || String(e);
      let friendly = "Enrollment failed: " + raw;
      if (raw.toLowerCase().includes("qr")) {
        friendly =
          "Supabase Auth couldn't generate a QR code right now. This usually means no email is set on the account. The system tried to auto-sync your primary email — if it still fails, re-link your Google or email account.";
      } else if (raw.toLowerCase().includes("mfa") && raw.toLowerCase().includes("disabled")) {
        friendly = "TOTP MFA is not enabled on this Supabase project. Enable it in Dashboard → Auth → MFA.";
      }
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    setBusy(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    } catch {
      /* ignore */
    }
    setEnrolling(null);
    setCode("");
    setBusy(false);
    await loadFactors();
  }

  async function verifyCode() {
    if (!enrolling) return;
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: chal.id,
        code,
      });
      if (vErr) throw vErr;
      await updateProfile({ data: { mfa_enrolled: true } as never }).catch(() => null);
      toast.success("Two-factor authentication enabled");
      setEnrolling(null);
      setCode("");
      await loadFactors();
    } catch (e) {
      toast.error("Incorrect code: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(factorId: string) {
    if (!(await confirmDialog({ variant: "danger", description: "Disable 2FA? Your account will be less secure." }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await updateProfile({ data: { mfa_enrolled: false } as never }).catch(() => null);
      toast.success("Two-factor authentication disabled");
      await loadFactors();
    } catch (e) {
      toast.error("Failed to disable: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold tracking-tight">
        <ShieldCheck className="size-4 text-indigo-600" />
        Two-Factor Authentication (TOTP)
      </h2>
      <p className="mb-4 text-xs font-medium text-slate-500">
        6-digit codes from Google Authenticator, Authy, or 1Password. Required for all internal roles.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading...
        </div>
      ) : verified ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span className="font-semibold text-emerald-700">2FA is active</span>
          </div>
          <button
            type="button"
            onClick={() => disableMfa(factors.find((f) => f.status === "verified")!.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            <ShieldOff className="size-3.5" /> Disable
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium text-slate-600">
              Scan this QR code in your authenticator app, or enter the secret manually:
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={enrolling.qr}
                alt="TOTP QR"
                className="size-40 rounded-md border border-slate-200 bg-white p-2"
              />
              <div className="w-full space-y-2">
                <div className="text-xs font-medium text-slate-500">Secret (manual entry):</div>
                <code className="block break-all rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs">
                  {enrolling.secret}
                </code>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Enter the 6-digit code from your app
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-indigo-500"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={verifyCode}
                disabled={busy || code.length !== 6}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Verify & Enable
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="size-3.5" /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Set up 2FA
        </button>
      )}
    </section>
  );
}
