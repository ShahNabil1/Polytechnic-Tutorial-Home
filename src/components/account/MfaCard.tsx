/**
 * TOTP (Authenticator app) enrollment card for internal users.
 * Uses Supabase Auth MFA API (aal2). On successful verify, updates
 * internal_profiles.mfa_enrolled via server fn.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncMyPrimaryAuthEmail, updateMyInternalProfile } from "@/lib/internal-profile.functions";
import { toEnglishDigits } from "@/lib/input-filter";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

export function MfaCard() {
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
      toast.error("MFA লোড করা যায়নি: " + error.message);
      setLoading(false);
      return;
    }
    const totp = (data?.totp ?? []) as Factor[];
    setFactors(totp);
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
        throw new Error("এই অ্যাকাউন্টে কোনো linked email পাওয়া যায়নি। আগে Google/email account লিংক করুন।");
      }
      // Clean up any lingering unverified factors first
      for (const f of factors.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `TOTP-${Date.now()}`,
        issuer: "Polytechnic Tutorial",
      });
      if (error) throw error;
      setEnrolling({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setCode("");
    } catch (e) {
      const err = e as { message?: string; code?: string; status?: number };
      const raw = err?.message || String(e);
      let friendly = "এনরোল ব্যর্থ: " + raw;
      if (raw.toLowerCase().includes("qr")) {
        friendly =
          "Supabase Auth এই মুহূর্তে QR তৈরি করতে পারছে না। সাধারণত অ্যাকাউন্টে ইমেইল সেট না থাকলে এটা হয়। " +
          "সিস্টেম primary email auto-sync করার চেষ্টা করেছে; তবুও না হলে Google/email account আবার লিংক করুন।";
      } else if (raw.toLowerCase().includes("mfa") && raw.toLowerCase().includes("disabled")) {
        friendly = "Supabase প্রোজেক্টে TOTP MFA চালু নেই। Dashboard → Auth → MFA থেকে TOTP অন করুন।";
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
    if (code.length !== 6) return toast.error("৬ ডিজিটের কোড দিন");
    setBusy(true);
    try {
      const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: chal.id,
        code,
      });
      if (vErr) throw vErr;
      await updateProfile({ data: { mfa_enrolled: true } as never }).catch(() => null);
      toast.success("2FA চালু হয়েছে");
      setEnrolling(null);
      setCode("");
      await loadFactors();
    } catch (e) {
      toast.error("কোড ভুল: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(factorId: string) {
    if (!(await confirmDialog({ variant: "danger", description: "2FA বন্ধ করতে চান? এতে অ্যাকাউন্ট কম সুরক্ষিত হয়ে যাবে।" }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await updateProfile({ data: { mfa_enrolled: false } as never }).catch(() => null);
      toast.success("2FA বন্ধ করা হয়েছে");
      await loadFactors();
    } catch (e) {
      toast.error("বন্ধ করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="size-4 text-brand" />
        টু-ফ্যাক্টর অথেন্টিকেশন (TOTP)
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Google Authenticator / Authy / 1Password app দিয়ে ৬-ডিজিট কোড। ইন্টারনাল রোলের জন্য বাধ্যতামূলক।
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
        </div>
      ) : verified ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              2FA সক্রিয়
            </span>
          </div>
          <button
            type="button"
            onClick={() => disableMfa(factors.find((f) => f.status === "verified")!.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
          >
            <ShieldOff className="size-3.5" /> বন্ধ করুন
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              আপনার Authenticator অ্যাপে এই QR স্ক্যান করুন, অথবা ম্যানুয়ালি সিক্রেট বসান:
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={enrolling.qr}
                alt="TOTP QR"
                className="size-40 rounded-md border border-border bg-white p-2"
              />
              <div className="w-full space-y-2">
                <div className="text-xs text-muted-foreground">Secret (ম্যানুয়াল এন্ট্রি):</div>
                <code className="block break-all rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono">
                  {enrolling.secret}
                </code>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              অ্যাপ থেকে ৬-ডিজিট কোড দিন
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(toEnglishDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                className="w-40 rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-brand"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={verifyCode}
                disabled={busy || code.length !== 6}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                ভেরিফাই ও চালু
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" /> বাতিল
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          2FA সেটআপ করুন
        </button>
      )}
    </section>
  );
}
