/**
 * First-login onboarding wall for internal accounts.
 *
 * Blocks the workspace/instructor shell until the user has:
 *   1. Set their full name (profile essentials)
 *   2. Changed their initial password
 *   3. (employees + super_admin only) Enrolled TOTP 2FA
 *
 * On completion, marks internal_profiles.first_login_completed = true.
 * Instructors skip step 3. Internal MFA is enforced on every visit, not only
 * first login, so disabling 2FA never leaves an already-completed account open.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  KeyRound,
  User as UserIcon,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthDrawer } from "@/components/auth-drawer";
import {
  getMyInternalProfile,
  completeInternalFirstLogin,
  syncMyPrimaryAuthEmail,
  updateMyInternalProfile,
} from "@/lib/internal-profile.functions";
import type { AppRole } from "@/lib/roles.functions";
import { toEnglishPassword, toEnglishText } from "@/lib/input-filter";
import { retrySupabaseAuth, signOutSafely } from "@/lib/auth-reliability";
import { useScrollLock } from "@/hooks/use-scroll-lock";

type Props = {
  role: AppRole;
  children: React.ReactNode;
};

type Step = "loading" | "profile" | "password" | "mfa" | "error" | "done";

export function InternalOnboardingGate({ role, children }: Props) {
  const { user } = useAuth();
  const getProfile = useServerFn(getMyInternalProfile);
  const markDone = useServerFn(completeInternalFirstLogin);
  const syncEmail = useServerFn(syncMyPrimaryAuthEmail);
  const updateInternal = useServerFn(updateMyInternalProfile);

  const [step, setStep] = useState<Step>("loading");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const requiresMfa = role === "employee" || role === "super_admin";
  useScrollLock(required && step !== "done" && step !== "loading");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setStep("loading");
      setRequired(false);
      setCheckError(null);
      try {
        const [profile, factors] = await Promise.all([
          getProfile({ data: undefined as never }),
          retrySupabaseAuth(() => supabase.auth.mfa.listFactors()),
        ]);
        if (cancelled) return;
        if (!profile) {
          setStep("done");
          setRequired(false);
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const hasName = !!(prof as { full_name?: string | null } | null)?.full_name?.trim();
        const hasVerifiedTotp = (factors.data?.totp ?? []).some((f) => f.status === "verified");
        setMfaVerified(hasVerifiedTotp);

        if (!profile.first_login_completed) {
          setRequired(true);
          if (!hasName) setStep("profile");
          else setStep("password");
          return;
        }

        if (requiresMfa && !hasVerifiedTotp) {
          await updateInternal({ data: { mfa_enrolled: false } as never }).catch(() => null);
          setRequired(true);
          setStep("mfa");
          return;
        }

        if (requiresMfa && hasVerifiedTotp && !profile.mfa_enrolled) {
          await updateInternal({ data: { mfa_enrolled: true } as never }).catch(() => null);
        }

        if (profile.first_login_completed) {
          setStep("done");
          setRequired(false);
          return;
        }
      } catch (err) {
        setRequired(true);
        setStep("error");
        setCheckError(err instanceof Error ? err.message : String(err));
        console.warn("Onboarding gate check failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getProfile, requiresMfa, updateInternal]);

  // Step 1: Profile (full name)
  const [fullName, setFullName] = useState("");
  useEffect(() => {
    if (step !== "profile" || !user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(((data as { full_name?: string | null } | null)?.full_name ?? "") as string);
      });
  }, [step, user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmed } as never)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Name saved");
      setStep("password");
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  // Step 2: Password change
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < 8) return toast.error("Password must be at least 8 characters.");
    if (pw1 !== pw2) return toast.error("Passwords do not match.");
    setSaving(true);
    try {
      const { error } = await retrySupabaseAuth(() => supabase.auth.updateUser({ password: pw1 }));
      if (error) throw error;
      toast.success("Password updated");
      setPw1("");
      setPw2("");
      if (requiresMfa && !mfaVerified) setStep("mfa");
      else await finish();
    } catch (err) {
      toast.error("Password change failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  // Step 3: MFA (only when required) is rendered inside the shared auth drawer.
  const [mfaVerified, setMfaVerified] = useState(false);

  async function finish() {
    try {
      await markDone({ data: undefined as never });
      setStep("done");
      setRequired(false);
    } catch (err) {
      toast.error("Could not finalize onboarding: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function retryGateCheck() {
    setCheckError(null);
    setStep("loading");
    // Changing this local state is enough to avoid rendering the protected shell;
    // the auth/role hooks will re-run the gate after the component settles.
    window.setTimeout(() => window.location.reload(), 50);
  }

  async function signOut() {
    await signOutSafely();
    window.location.href = "/";
  }

  const stepIndex = useMemo(() => {
    const steps: Step[] = ["profile", "password", ...(requiresMfa ? ["mfa" as Step] : [])];
    const idx = steps.indexOf(step);
    return { idx: idx < 0 ? 0 : idx, total: steps.length };
  }, [step, requiresMfa]);

  if (!required || step === "done") return <>{children}</>;
  if (step === "mfa" && requiresMfa && !mfaVerified) {
    return (
      <div className="min-h-[60vh]">
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparing secure 2FA setup...
          </div>
        </div>
        <AuthDrawer
          open={true}
          onOpenChange={() => undefined}
          mfaEnrollmentOpen={true}
          onBeforeMfaEnrollment={() => syncEmail({ data: undefined as never }).then(() => undefined)}
          onMfaEnrollmentComplete={async () => {
            await updateInternal({ data: { mfa_enrolled: true } as never }).catch(() => null);
            setMfaVerified(true);
            await finish();
          }}
          onMfaEnrollmentCancel={signOut}
        />
      </div>
    );
  }
  if (step === "loading") {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="font-display text-lg font-bold text-slate-950">Security check required</h2>
          <p className="mt-2 text-sm text-slate-600">
            We couldn't verify your 2FA status yet, so the workspace is locked until the check succeeds.
          </p>
          {checkError && <p className="mt-3 break-words text-xs text-slate-400">{checkError}</p>}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={retryGateCheck}
              className="inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">
                First-time setup
              </div>
              <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
                Welcome — let's secure your account
              </h2>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            {Array.from({ length: stepIndex.total }).map((_, i) => (
              <div
                key={i}
                className={
                  "h-1.5 flex-1 rounded-full " + (i <= stepIndex.idx ? "bg-indigo-400" : "bg-white/15")
                }
              />
            ))}
            <span className="ml-2 font-semibold text-white/70">
              {stepIndex.idx + 1} / {stepIndex.total}
            </span>
          </div>
        </div>

        <div className="p-6">
          {step === "profile" && (
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserIcon className="size-4 text-indigo-600" /> Confirm your name
              </div>
              <p className="text-xs font-medium text-slate-500">
                This is the name that appears throughout the workspace.
              </p>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(toEnglishText(e.target.value))}
                placeholder="Your full name"
                autoFocus
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Continue
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={changePassword} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <KeyRound className="size-4 text-indigo-600" /> Change your password
              </div>
              <p className="text-xs font-medium text-slate-500">
                Replace the initial password your admin set. Minimum 8 characters.
              </p>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={pw1}
                    onChange={(e) => setPw1(toEnglishPassword(e.target.value))}
                    placeholder="New password"
                    autoComplete="new-password"
                    autoFocus
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute inset-y-0 right-2 grid place-items-center text-slate-500 hover:text-slate-800"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(toEnglishPassword(e.target.value))}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {requiresMfa ? "Continue to 2FA" : "Finish setup"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
