import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Copy, Check, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { checkPhoneAvailability } from "@/lib/auth.functions";
import { toEnglishText, toEnglishPassword, friendlyPasswordError } from "@/lib/input-filter";
import { authErrorMessage, retrySupabaseAuth, signOutSafely, waitForUsableSession } from "@/lib/auth-reliability";
import { getMyAccountStatus } from "@/lib/account-status.functions";
import { getMyRoleInfo, type AppRole } from "@/lib/roles.functions";
import { syncMyPrimaryAuthEmail, updateMyInternalProfile } from "@/lib/internal-profile.functions";
import { useCartDrawer } from "@/lib/cart-drawer-store";

type Tab = "login" | "signup";
type Stage = "form" | "otp" | "mfa" | "mfa-enroll" | "reset";
type OtpFlow = "signup" | "forgot";
type MfaPurpose = "password-reset" | "session";
type MfaEnrollment = { factorId: string; qr: string; secret: string };
type AuthTarget = "/sdash" | "/instructor" | "/workspace";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 3;
const LOCKOUT_MINUTES = 5;
const AUTH_TIMEOUT_MS = 20_000;

function targetForRole(role: AppRole): AuthTarget {
  if (role === "instructor") return "/instructor";
  if (role === "employee" || role === "super_admin") return "/workspace";
  return "/sdash";
}

function withTimeout<T>(promise: PromiseLike<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function bnToEnDigits(s: string): string {
  const map: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return s.replace(/[০-৯٠-٩]/g, (d) => map[d] ?? d);
}

function normalizePhone(raw: string): string {
  const digits = bnToEnDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("88")) return "+" + digits;
  if (digits.startsWith("0")) return "+88" + digits;
  return "+88" + digits;
}

function isValidBdMobile(raw: string): boolean {
  const digits = bnToEnDigits(raw).replace(/\D/g, "");
  return /^01[3-9]\d{8}$/.test(digits);
}

function errMsg(e: unknown, fallback = "কিছু ভুল হয়েছে, আবার চেষ্টা করুন"): string {
  const friendly = authErrorMessage(e, fallback);
  if (friendly) return friendly;
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const anyE = e as { message?: string; error_description?: string; msg?: string };
    return anyE.message || anyE.error_description || anyE.msg || fallback;
  }
  return fallback;
}

function getPasskeyClient() {
  return import("@/lib/passkey-client");
}

function PasswordFieldEl({
  id = "auth-password",
  label = "পাসওয়ার্ড",
  value,
  onChange,
  autoComplete,
  showPassword,
  onToggleVisibility,
  onClearError,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  showPassword: boolean;
  onToggleVisibility: () => void;
  onClearError: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          value={value}
          onChange={(e) => {
            onChange(toEnglishPassword(e.target.value));
            onClearError();
          }}
          required
          minLength={6}
          className="pr-9"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleVisibility}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function AuthDrawer({
  open,
  onOpenChange,
  sessionMfaFactorId = null,
  mfaEnrollmentOpen = false,
  onBeforeMfaEnrollment,
  onMfaEnrollmentComplete,
  onMfaEnrollmentCancel,
  onSessionMfaComplete,
  onSessionMfaCancel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionMfaFactorId?: string | null;
  mfaEnrollmentOpen?: boolean;
  onBeforeMfaEnrollment?: () => Promise<void>;
  onMfaEnrollmentComplete?: () => Promise<void> | void;
  onMfaEnrollmentCancel?: () => Promise<void> | void;
  onSessionMfaComplete?: () => void;
  onSessionMfaCancel?: () => void;
}) {
  const navigate = useNavigate();
  const fetchAccountStatus = useServerFn(getMyAccountStatus);
  const fetchRoleInfo = useServerFn(getMyRoleInfo);
  const syncInternalEmail = useServerFn(syncMyPrimaryAuthEmail);
  const updateInternal = useServerFn(updateMyInternalProfile);
  const closeCartDrawer = useCartDrawer((s) => s.closeDrawer);
  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("form");
  const [otpFlow, setOtpFlow] = useState<OtpFlow>("signup");
  const [forgotMode, setForgotMode] = useState(false);

  const [phoneRaw, setPhoneRaw] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaPurpose, setMfaPurpose] = useState<MfaPurpose | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [localMfaEnrollmentOpen, setLocalMfaEnrollmentOpen] = useState(false);
  const [postAuthRedirectTo, setPostAuthRedirectTo] = useState<AuthTarget | null>(null);

  const [loading, setLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Resend control
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);
  const tickRef = useRef<number | null>(null);
  const sessionMfaInitRef = useRef<string | null>(null);
  const mfaEnrollmentStartedRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0 && lockedUntil === null) return;
    tickRef.current = window.setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
      if (lockedUntil) {
        const rem = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
        setLockRemaining(rem);
        if (rem === 0) {
          setLockedUntil(null);
          setResendCount(0);
        }
      }
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [cooldown, lockedUntil]);

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const inProgress =
    phoneRaw.length > 0 ||
    otp.length > 0 ||
    fullName.length > 0 ||
    password.length > 0 ||
    confirmPassword.length > 0;

  function resetAll() {
    setPhoneRaw("");
    setFullName("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setMfaCode("");
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaPurpose(null);
    setMfaEnrollment(null);
    setLocalMfaEnrollmentOpen(false);
    setPostAuthRedirectTo(null);
    sessionMfaInitRef.current = null;
    mfaEnrollmentStartedRef.current = false;
    setStage("form");
    setTab("login");
    setForgotMode(false);
    setFormError(null);
    setInfoMsg(null);
    setCooldown(0);
    setResendCount(0);
    setLockedUntil(null);
  }

  function switchTab(t: Tab) {
    setTab(t);
    setStage("form");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
    setForgotMode(false);
    setFormError(null);
    setInfoMsg(null);
  }

  function requestClose() {
    if (mfaPurpose === "session" || stage === "mfa-enroll") return;
    if (inProgress) setConfirmClose(true);
    else onOpenChange(false);
  }

  async function startMfaChallenge(factorId: string, purpose: MfaPurpose) {
    const { data: chal, error } = await retrySupabaseAuth(() => supabase.auth.mfa.challenge({ factorId }));
    if (error) throw error;
    setMfaFactorId(factorId);
    setMfaChallengeId(chal.id);
    setMfaCode("");
    setMfaPurpose(purpose);
    setStage("mfa");
    setInfoMsg(
      purpose === "session"
        ? "আপনার Authenticator অ্যাপ থেকে ৬-ডিজিট 2FA কোড দিন"
        : "আপনার Authenticator অ্যাপ থেকে ৬-ডিজিট 2FA কোড দিন",
    );
  }

  function finishPostAuthRedirect(target: AuthTarget) {
    closeCartDrawer();
    resetAll();
    onOpenChange(false);
    navigate({ to: target, replace: true });
  }

  async function beginSessionMfaIfNeeded(redirectTo?: AuthTarget): Promise<boolean> {
    const { data: aal } = await retrySupabaseAuth(() => supabase.auth.mfa.getAuthenticatorAssuranceLevel());
    if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") return false;
    const { data: factors } = await retrySupabaseAuth(() => supabase.auth.mfa.listFactors());
    const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!totp) return false;
    setPostAuthRedirectTo(redirectTo ?? null);
    await startMfaChallenge(totp.id, "session");
    return true;
  }

  async function completeSignedInFlow(successMessage: string) {
    setLoading(true);
    try {
      const session = await waitForUsableSession();
      if (!session) throw new Error("No active auth session");

      const accountStatus = (await fetchAccountStatus(undefined as never)) as { active: boolean };
      if (accountStatus.active === false) {
        await signOutSafely();
        throw new Error("আপনার একাউন্টটি ডিএ্যাক্টিভ করা হয়েছে। এ্যাক্টিভ না করা পর্যন্ত লগইন করা যাবে না।");
      }

      const roleInfo = (await fetchRoleInfo(undefined as never)) as { primaryRole: AppRole };
      const target = targetForRole(roleInfo.primaryRole);
      closeCartDrawer();
      setPostAuthRedirectTo(target);

      const { data: factors, error: factorsError } = await retrySupabaseAuth(() => supabase.auth.mfa.listFactors());
      if (factorsError) throw factorsError;
      const verifiedTotp = (factors?.totp ?? []).find((factor) => factor.status === "verified");
      if (verifiedTotp) {
        const needsMfa = await beginSessionMfaIfNeeded(target);
        setLoading(false);
        if (needsMfa) return;
        toast.success(successMessage);
        finishPostAuthRedirect(target);
        return;
      }

      if (target === "/workspace") {
        await syncInternalEmail({ data: undefined as never }).catch(() => undefined);
        setLocalMfaEnrollmentOpen(true);
        setStage("mfa-enroll");
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success(successMessage);
      finishPostAuthRedirect(target);
    } catch (error) {
      setLoading(false);
      setFormError(errMsg(error));
    }
  }

  useEffect(() => {
    if (!open || !sessionMfaFactorId) return;
    if (sessionMfaInitRef.current === sessionMfaFactorId && stage === "mfa") return;
    sessionMfaInitRef.current = sessionMfaFactorId;
    setLoading(true);
    setFormError(null);
    setInfoMsg(null);
    startMfaChallenge(sessionMfaFactorId, "session")
      .catch((error) => setFormError("2FA যাচাই শুরু করা যায়নি। আবার চেষ্টা করুন। " + errMsg(error)))
      .finally(() => setLoading(false));
  }, [open, sessionMfaFactorId, stage]);

  useEffect(() => {
    const enrollmentOpen = mfaEnrollmentOpen || localMfaEnrollmentOpen;
    if (!open || !enrollmentOpen) return;
    if (mfaEnrollmentStartedRef.current) return;
    mfaEnrollmentStartedRef.current = true;
    setStage("mfa-enroll");
    setFormError(null);
    setInfoMsg(null);
    setMfaCode("");
    setLoading(true);
    (async () => {
      try {
        await onBeforeMfaEnrollment?.();
        const { data: list, error: listError } = await retrySupabaseAuth(() => supabase.auth.mfa.listFactors());
        if (listError) throw listError;
        const verified = (list?.totp ?? []).find((factor) => factor.status === "verified");
        if (verified) {
          if (localMfaEnrollmentOpen) {
            await updateInternal({ data: { mfa_enrolled: true } as never }).catch(() => null);
            toast.success("2FA চালু আছে");
            finishPostAuthRedirect(postAuthRedirectTo ?? "/workspace");
            return;
          }
          await onMfaEnrollmentComplete?.();
          resetAll();
          onOpenChange(false);
          return;
        }
        for (const factor of list?.totp ?? []) {
          if (factor.status !== "verified") {
            await retrySupabaseAuth(() => supabase.auth.mfa.unenroll({ factorId: factor.id }));
          }
        }
        const { data, error } = await retrySupabaseAuth(() => supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `TOTP-${Date.now()}`,
          issuer: "Polytechnic Tutorial",
        }));
        if (error) throw error;
        setMfaEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
        setInfoMsg("Authenticator অ্যাপে QR স্ক্যান করে ৬-ডিজিট কোড দিন");
      } catch (error) {
        setFormError("2FA সেটআপ শুরু করা যায়নি। " + errMsg(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, mfaEnrollmentOpen, localMfaEnrollmentOpen, onBeforeMfaEnrollment, onMfaEnrollmentComplete, onOpenChange]);

  function confirmDiscard() {
    setConfirmClose(false);
    resetAll();
    onOpenChange(false);
  }

  function handlePhoneChange(v: string) {
    const digits = bnToEnDigits(v).replace(/\D/g, "").slice(0, 11);
    setPhoneRaw(digits);
    if (formError) setFormError(null);
  }

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await retrySupabaseAuth(() => supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      }));
      if (error) {
        setLoading(false);
        toast.error(errMsg(error));
      }
    } catch (e) {
      setLoading(false);
      toast.error(errMsg(e));
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (!isValidBdMobile(phoneRaw)) {
      setFormError("সঠিক ১১ ডিজিটের নাম্বার দিন (013–019 দিয়ে শুরু)");
      return;
    }
    if (password.length < 6) {
      setFormError("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
      return;
    }
    setLoading(true);
    try {
      const { error } = await withTimeout(
        retrySupabaseAuth(() => supabase.auth.signInWithPassword({ phone, password })),
        "লগইন হতে বেশি সময় লাগছে। ইন্টারনেট চেক করে আবার চেষ্টা করুন।",
      );
      setLoading(false);
      if (error) {
        const msg = (errMsg(error) || "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials")) {
          setFormError("ফোন নাম্বার অথবা পাসওয়ার্ড ভুল। রেজিস্টার্ড না হলে নতুন একাউন্ট খুলুন।");
        } else {
          setFormError(errMsg(error));
        }
        return;
      }
      await completeSignedInFlow("সাইন ইন সফল");
    } catch (err) {
      setLoading(false);
      setFormError(errMsg(err));
    }
  }

  async function handleSignupStart(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (!fullName.trim()) return setFormError("আপনার পূর্ণ নাম দিন");
    if (!isValidBdMobile(phoneRaw)) return setFormError("সঠিক ১১ ডিজিটের নাম্বার দিন (013–019 দিয়ে শুরু)");
    if (password.length < 6) return setFormError("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    if (password !== confirmPassword) return setFormError("পাসওয়ার্ড দুটো মিলছে না");

    setLoading(true);
    try {
      const availability = await withTimeout(
        checkPhoneAvailability({ data: { phone } }),
        "নাম্বার যাচাই হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
      );

      if (availability.registered) {
        setLoading(false);
        setFormError("এই নাম্বারে ইতিমধ্যে একাউন্ট আছে। লগইন ট্যাবে যান।");
        return;
      }

      const { error } = await withTimeout(
        retrySupabaseAuth(() => supabase.auth.signUp({
          phone,
          password,
          options: { data: { full_name: fullName } },
        })),
        "সাইন আপ শুরু হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
      );
      setLoading(false);
      if (error) {
        const msg = (errMsg(error) || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          setFormError("এই নাম্বারে ইতিমধ্যে একাউন্ট আছে। লগইন ট্যাবে যান।");
        } else {
          setFormError(errMsg(error));
        }
        return;
      }
      setOtpFlow("signup");
      setStage("otp");
      setInfoMsg("OTP পাঠানো হয়েছে আপনার ফোনে");
      startCooldown();
      setResendCount(0);
    } catch (err) {
      setLoading(false);
      setFormError(errMsg(err));
    }
  }

  async function handleForgotStart(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (!isValidBdMobile(phoneRaw)) return setFormError("সঠিক ১১ ডিজিটের নাম্বার দিন (013–019 দিয়ে শুরু)");

    setLoading(true);
    try {
      // shouldCreateUser: false → only send if account exists
      const { error } = await withTimeout(retrySupabaseAuth(() => supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      })), "OTP পাঠাতে বেশি সময় লাগছে। আবার চেষ্টা করুন।");
      setLoading(false);
      if (error) {
        const msg = (errMsg(error) || "").toLowerCase();
        if (msg.includes("signups not allowed") || msg.includes("not found") || msg.includes("user not")) {
          setFormError("এই নাম্বারে কোনো একাউন্ট নেই");
        } else {
          setFormError(errMsg(error));
        }
        return;
      }
      setOtpFlow("forgot");
      setStage("otp");
      setInfoMsg("পাসওয়ার্ড রিসেটের জন্য OTP পাঠানো হয়েছে");
      startCooldown();
      setResendCount(0);
    } catch (err) {
      setLoading(false);
      setFormError(errMsg(err));
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (otp.length < 4) return setFormError("OTP কোডটি সম্পূর্ণ দিন");

    setLoading(true);
    try {
      const { error } = await withTimeout(
        retrySupabaseAuth(() => supabase.auth.verifyOtp({ phone, token: otp, type: "sms" })),
        "OTP যাচাই হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
      );
      if (error) {
        setLoading(false);
        const msg = (errMsg(error) || "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("expired") || msg.includes("token")) {
          setFormError("OTP কোডটি ভুল অথবা মেয়াদ শেষ। আবার পাঠান।");
        } else {
          setFormError(errMsg(error));
        }
        return;
      }

      if (otpFlow === "signup") {
        const { data: userData } = await retrySupabaseAuth(() => supabase.auth.getUser());
        if (userData.user) {
          await supabase
            .from("profiles")
            .update({
              phone_verified: true,
              phone,
              ...(fullName ? { full_name: fullName } : {}),
            })
            .eq("id", userData.user.id);
        }
        await completeSignedInFlow("একাউন্ট তৈরি হয়েছে");
      } else {
        // forgot flow: phone OTP verified.
        // If this account has a verified TOTP factor (staff / super admin),
        // require the 2FA code before allowing password reset.
        try {
          const { data: factors } = await retrySupabaseAuth(() => supabase.auth.mfa.listFactors());
          const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
          if (totp) {
            await startMfaChallenge(totp.id, "password-reset");
            setLoading(false);
            return;
          }
        } catch (mfaErr) {
          setLoading(false);
          setFormError("2FA যাচাই শুরু করা যায়নি: " + errMsg(mfaErr));
          return;
        }
        setLoading(false);
        setPassword("");
        setConfirmPassword("");
        setStage("reset");
        setInfoMsg("এখন নতুন পাসওয়ার্ড সেট করুন");
      }
    } catch (err) {
      setLoading(false);
      setFormError(errMsg(err));
    }
  }

  async function handleVerifyMfaOtp(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (!mfaFactorId || !mfaChallengeId) {
      setFormError("2FA সেশন হারিয়ে গেছে, আবার চেষ্টা করুন");
      setStage("form");
      return;
    }
    if (mfaCode.length !== 6) return setFormError("৬ ডিজিটের 2FA কোড দিন");
    setLoading(true);
    try {
      const { error } = await retrySupabaseAuth(() => supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      }));
      if (error) {
        setLoading(false);
        setFormError("2FA কোড ভুল বা মেয়াদ শেষ");
        return;
      }
      if (mfaPurpose === "session") {
        const target = postAuthRedirectTo;
        setLoading(false);
        toast.success("2FA সফল");
        resetAll();
        onSessionMfaComplete?.();
        onOpenChange(false);
        if (target) {
          closeCartDrawer();
          navigate({ to: target, replace: true });
        }
        return;
      }
      setLoading(false);
      setMfaCode("");
      setMfaFactorId(null);
      setMfaChallengeId(null);
      setMfaPurpose(null);
      setPassword("");
      setConfirmPassword("");
      setStage("reset");
      setInfoMsg("2FA যাচাই সফল। এখন নতুন পাসওয়ার্ড সেট করুন");
    } catch (err) {
      setLoading(false);
      setFormError(errMsg(err));
    }
  }

  async function handleVerifyMfaEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (!mfaEnrollment) return setFormError("2FA সেটআপ প্রস্তুত নয়, আবার চেষ্টা করুন");
    if (mfaCode.length !== 6) return setFormError("৬ ডিজিটের 2FA কোড দিন");
    setLoading(true);
    try {
      const { data: chal, error: cErr } = await retrySupabaseAuth(() => supabase.auth.mfa.challenge({
        factorId: mfaEnrollment.factorId,
      }));
      if (cErr) throw cErr;
      const { error: vErr } = await retrySupabaseAuth(() => supabase.auth.mfa.verify({
        factorId: mfaEnrollment.factorId,
        challengeId: chal.id,
        code: mfaCode,
      }));
      if (vErr) {
        setLoading(false);
        setFormError("2FA কোড ভুল বা মেয়াদ শেষ");
        return;
      }
      if (localMfaEnrollmentOpen) {
        await updateInternal({ data: { mfa_enrolled: true } as never }).catch(() => null);
        const target = postAuthRedirectTo ?? "/workspace";
        setLoading(false);
        toast.success("2FA চালু হয়েছে");
        finishPostAuthRedirect(target);
        return;
      }
      await onMfaEnrollmentComplete?.();
      setLoading(false);
      toast.success("2FA চালু হয়েছে");
      resetAll();
      onOpenChange(false);
    } catch (error) {
      setLoading(false);
      setFormError(errMsg(error));
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInfoMsg(null);
    if (password.length < 6) return setFormError("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    if (password !== confirmPassword) return setFormError("পাসওয়ার্ড দুটো মিলছে না");

    setLoading(true);
    try {
      const { error } = await retrySupabaseAuth(() => supabase.auth.updateUser({ password }));
      if (error) {
        setLoading(false);
        setFormError(friendlyPasswordError(error));
        return;
      }
      await signOutSafely();
      setLoading(false);
      toast.success("পাসওয়ার্ড আপডেট হয়েছে। এবার নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
      resetAll();
      // stay open on login tab
      setTab("login");
    } catch (err) {
      setLoading(false);
      setFormError(friendlyPasswordError(err));
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || lockedUntil) return;
    if (resendCount >= MAX_RESENDS) {
      const until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
      setLockedUntil(until);
      setLockRemaining(LOCKOUT_MINUTES * 60);
      setFormError(`অনেক বার রিসেন্ড হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন।`);
      return;
    }
    setFormError(null);
    setInfoMsg(null);
    try {
      const { error } = await retrySupabaseAuth(() => supabase.auth.resend({ type: "sms", phone }));
      if (error) {
        setFormError(errMsg(error));
        return;
      }
      setResendCount((n) => n + 1);
      startCooldown();
      setInfoMsg(`OTP আবার পাঠানো হয়েছে (${resendCount + 1}/${MAX_RESENDS})`);
    } catch (err) {
      setFormError(errMsg(err));
    }
  }

  async function handlePasskeyLogin() {
    setFormError(null);
    setInfoMsg(null);
    const passkeyClient = await getPasskeyClient();
    if (!passkeyClient.isPasskeySupported()) {
      setFormError("এই ব্রাউজারে Passkey সাপোর্ট নেই");
      return;
    }
    setLoading(true);
    try {
      // Discoverable flow — OS/browser picks the resident passkey; no phone
      // number required. If the user typed a phone, we still pass it as a
      // hint so allowCredentials can be scoped for older authenticators.
      const phoneHint = isValidBdMobile(phoneRaw) ? phone : undefined;
      await passkeyClient.signInWithPasskey(phoneHint);
      await completeSignedInFlow("Passkey দিয়ে সাইন ইন সফল");
    } catch (e) {
      setLoading(false);
      const msg = errMsg(e);
      if (/NotAllowed|cancel|abort/i.test(msg)) {
        setFormError("Passkey প্রম্পট বাতিল হয়েছে");
      } else if (/no.*credential|not.*registered|not.*found/i.test(msg)) {
        setFormError("এই ডিভাইসে কোনো Passkey সেভ করা নেই। প্রথমে পাসওয়ার্ড দিয়ে লগইন করুন।");
      } else {
        setFormError(msg);
      }
    }
  }

  const PhoneField = (
    <div className="space-y-2">
      <Label htmlFor="auth-phone">ফোন নাম্বার</Label>
      <div
        className={cn(
          "flex overflow-hidden rounded-md border focus-within:ring-2",
          formError
            ? "border-destructive focus-within:ring-destructive/30"
            : "border-input focus-within:ring-ring",
        )}
      >
        <span className="flex items-center gap-1.5 border-r border-input bg-muted px-3 text-sm text-muted-foreground">
          <svg width="20" height="14" viewBox="0 0 10 6" className="shrink-0 rounded-sm">
            <rect width="10" height="6" fill="#006A4E" />
            <circle cx="4.5" cy="3" r="2" fill="#F42A41" />
          </svg>
          +88
        </span>
        <input
          id="auth-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          value={phoneRaw}
          onChange={(e) => handlePhoneChange(e.target.value)}
          maxLength={11}
          required
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
    </div>
  );

  const clearFormError = () => {
    if (formError) setFormError(null);
  };

  const ErrorBox = formError ? (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <span>{formError}</span>
    </div>
  ) : null;

  const InfoBox = infoMsg ? (
    <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
      <span>{infoMsg}</span>
    </div>
  ) : null;

  const cardTitle =
    stage === "reset"
      ? "নতুন পাসওয়ার্ড সেট করুন"
      : stage === "mfa-enroll"
      ? "Two-Factor Setup"
      : stage === "mfa"
        ? "টু-ফ্যাক্টর কোড দিন"
        : stage === "otp"
        ? "ফোন ভেরিফাই করুন"
        : forgotMode
          ? "পাসওয়ার্ড রিসেট করুন"
          : tab === "login"
            ? "একাউন্টে লগিন করুন"
            : "নতুন একাউন্ট তৈরি করুন";

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v) requestClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col gap-0 p-0 h-[100dvh] max-h-[100dvh] overscroll-contain"
          onInteractOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-base font-semibold">
              PTH এর সাথে শেখা শুরু করি
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-6">
            <div className="w-full max-w-sm">
                <div className="min-h-[350px] rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 text-center">
                  <h2 className="text-lg font-semibold">{cardTitle}</h2>
                </div>

                {stage === "form" && !forgotMode && (
                  <div className="mb-4 grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
                    {(["login", "signup"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => switchTab(t)}
                        className={cn(
                          "rounded-md py-2 text-sm font-medium transition-colors",
                          tab === t
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t === "login" ? "লগিন" : "নতুন একাউন্ট"}
                      </button>
                    ))}
                  </div>
                )}

                {/* LOGIN */}
                {stage === "form" && tab === "login" && !forgotMode && (
                  <form className="space-y-4" onSubmit={handleLogin}>
                    {PhoneField}
                    <PasswordFieldEl
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      showPassword={showPassword}
                      onToggleVisibility={() => setShowPassword((s) => !s)}
                      onClearError={clearFormError}
                    />
                    <div className="flex justify-end -mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setPassword("");
                          setFormError(null);
                          setInfoMsg(null);
                        }}
                        className="text-xs text-brand hover:underline"
                      >
                        পাসওয়ার্ড ভুলে গেছেন?
                      </button>
                    </div>
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading}
                    >
                      {loading ? "লগইন হচ্ছে..." : "লগইন"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handlePasskeyLogin}
                      disabled={loading}
                    >
                      <KeyRound className="mr-2 size-4" />
                      Passkey দিয়ে লগইন
                    </Button>
                  </form>
                )}

                {/* FORGOT PASSWORD - phone entry */}
                {stage === "form" && forgotMode && (
                  <form className="space-y-4" onSubmit={handleForgotStart}>
                    <p className="text-xs text-muted-foreground">
                      আপনার রেজিস্টার্ড নাম্বার দিন — OTP পাঠিয়ে ভেরিফাই করে নতুন পাসওয়ার্ড সেট করতে পারবেন।
                    </p>
                    {PhoneField}
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading}
                    >
                      {loading ? "পাঠানো হচ্ছে..." : "OTP পাঠান"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(false);
                        setFormError(null);
                        setInfoMsg(null);
                      }}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← লগইনে ফিরে যান
                    </button>
                  </form>
                )}

                {/* SIGNUP */}
                {stage === "form" && tab === "signup" && !forgotMode && (
                  <form className="space-y-4" onSubmit={handleSignupStart}>
                    <div className="space-y-2">
                      <Label htmlFor="auth-name">পূর্ণ নাম</Label>
                      <Input
                        id="auth-name"
                        placeholder="আপনার নাম"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(toEnglishText(e.target.value));
                          if (formError) setFormError(null);
                        }}
                        autoComplete="name"
                        required
                      />
                    </div>
                    {PhoneField}
                    <PasswordFieldEl
                      value={password}
                      onChange={setPassword}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onToggleVisibility={() => setShowPassword((s) => !s)}
                      onClearError={clearFormError}
                    />
                    <PasswordFieldEl
                      id="auth-confirm"
                      label="পাসওয়ার্ড কনফার্ম"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onToggleVisibility={() => setShowPassword((s) => !s)}
                      onClearError={clearFormError}
                    />
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading}
                    >
                      {loading ? "পাঠানো হচ্ছে..." : "সাইন আপ"}
                    </Button>
                  </form>
                )}

                {/* OTP */}
                {stage === "otp" && (
                  <form className="space-y-4" onSubmit={handleVerifyOtp}>
                    <div className="rounded-lg bg-muted/60 p-3 text-sm">
                      <strong>+88{phoneRaw}</strong> নাম্বারে ৬-ডিজিটের OTP পাঠানো হয়েছে
                    </div>
                    {InfoBox}
                    <div className="space-y-2">
                      <Label htmlFor="auth-otp">OTP কোড</Label>
                      <Input
                        id="auth-otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(bnToEnDigits(e.target.value).replace(/\D/g, ""))}
                        required
                        autoFocus
                      />
                    </div>
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading || otp.length < 4}
                    >
                      {loading
                        ? "যাচাই করা হচ্ছে..."
                        : otpFlow === "signup"
                          ? "ভেরিফাই ও একাউন্ট তৈরি"
                          : "ভেরিফাই করুন"}
                    </Button>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setStage("form");
                          setOtp("");
                          setFormError(null);
                          setInfoMsg(null);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ← ফিরে যান
                      </button>
                      {lockedUntil ? (
                        <span className="text-destructive">
                          {LOCKOUT_MINUTES} মিনিটের জন্য লকড ({Math.floor(lockRemaining / 60)}:
                          {String(lockRemaining % 60).padStart(2, "0")})
                        </span>
                      ) : cooldown > 0 ? (
                        <span className="text-muted-foreground">
                          আবার পাঠান ({cooldown}s)
                        </span>
                      ) : resendCount >= MAX_RESENDS ? (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="text-destructive hover:underline"
                        >
                          লিমিট পৌঁছেছে
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="text-brand hover:underline"
                        >
                          কোড আবার পাঠান ({MAX_RESENDS - resendCount} বার বাকি)
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* MFA (2FA) — session challenge / forgot-password gate */}
                {stage === "mfa" && (
                  <form className="space-y-4" onSubmit={handleVerifyMfaOtp}>
                    <div className="rounded-lg bg-muted/60 p-3 text-sm">
                      {mfaPurpose === "session"
                        ? "আপনার একাউন্টে টু-ফ্যাক্টর অথেন্টিকেশন চালু আছে। চালিয়ে যেতে Authenticator অ্যাপ থেকে ৬-ডিজিট কোড দিন।"
                        : "আপনার একাউন্টে টু-ফ্যাক্টর অথেন্টিকেশন চালু আছে। পাসওয়ার্ড রিসেট করার আগে Authenticator অ্যাপ থেকে ৬-ডিজিট কোড দিন।"}
                    </div>
                    {InfoBox}
                    <div className="space-y-2">
                      <Label htmlFor="auth-mfa">২FA কোড</Label>
                      <Input
                        id="auth-mfa"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) =>
                          setMfaCode(bnToEnDigits(e.target.value).replace(/\D/g, "").slice(0, 6))
                        }
                        required
                        autoFocus
                      />
                    </div>
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading || mfaCode.length !== 6}
                    >
                      {loading ? "যাচাই করা হচ্ছে..." : <><ShieldCheck className="mr-2 size-4" />ভেরিফাই করুন</>}
                    </Button>
                    <div className="text-center text-xs">
                      <button
                        type="button"
                        onClick={async () => {
                          await signOutSafely();
                          onSessionMfaCancel?.();
                          resetAll();
                          onOpenChange(false);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ← বাতিল করে সাইন আউট
                      </button>
                    </div>
                  </form>
                )}

                {/* MFA enrollment — first-time internal setup */}
                {stage === "mfa-enroll" && (
                  <form className="space-y-4" onSubmit={handleVerifyMfaEnrollment}>
                    {InfoBox}
                    {!mfaEnrollment ? (
                      <div className="rounded-lg border border-border bg-background px-3 py-8 text-center text-sm text-muted-foreground">
                        {loading ? "2FA সেটআপ প্রস্তুত হচ্ছে..." : "2FA সেটআপ শুরু করুন"}
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-border bg-muted/40 p-3">
                          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                            <img
                              src={mfaEnrollment.qr}
                              alt="2FA QR code"
                              className="size-32 rounded-md border border-border bg-background p-2"
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                                Manual secret
                              </div>
                              <code className="block break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
                                {mfaEnrollment.secret}
                              </code>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(mfaEnrollment.secret);
                                    setSecretCopied(true);
                                    setTimeout(() => setSecretCopied(false), 2000);
                                  } catch {
                                    toast.error("কপি করা যায়নি");
                                  }
                                }}
                                className={cn(
                                  "h-7 gap-1.5 px-2.5 text-xs transition-colors",
                                  secretCopied &&
                                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400"
                                )}
                              >
                                {secretCopied ? (
                                  <>
                                    <Check className="size-3.5" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" />
                                    Copy Secret
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auth-mfa-enroll">2FA Code:</Label>
                          <Input
                            id="auth-mfa-enroll"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={mfaCode}
                            onChange={(e) =>
                              setMfaCode(bnToEnDigits(e.target.value).replace(/\D/g, "").slice(0, 6))
                            }
                            required
                            autoFocus
                          />
                        </div>
                      </>
                    )}
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading || !mfaEnrollment || mfaCode.length !== 6}
                    >
                      {loading ? "যাচাই করা হচ্ছে..." : <><ShieldCheck className="mr-2 size-4" />2FA চালু করুন</>}
                    </Button>
                    <div className="text-center text-xs">
                      <button
                        type="button"
                        onClick={async () => {
                          if (mfaEnrollment) {
                            await retrySupabaseAuth(() => supabase.auth.mfa.unenroll({ factorId: mfaEnrollment.factorId })).catch(() => undefined);
                          }
                          await onMfaEnrollmentCancel?.();
                          resetAll();
                          onOpenChange(false);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ← বাতিল করুন
                      </button>
                    </div>
                  </form>
                )}

                {/* RESET PASSWORD */}
                {stage === "reset" && (
                  <form className="space-y-4" onSubmit={handleResetPassword}>
                    {InfoBox}
                    <PasswordFieldEl
                      label="নতুন পাসওয়ার্ড"
                      value={password}
                      onChange={setPassword}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onToggleVisibility={() => setShowPassword((s) => !s)}
                      onClearError={clearFormError}
                    />
                    <PasswordFieldEl
                      id="auth-confirm"
                      label="পাসওয়ার্ড কনফার্ম"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                      showPassword={showPassword}
                      onToggleVisibility={() => setShowPassword((s) => !s)}
                      onClearError={clearFormError}
                    />
                    {ErrorBox}
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading}
                    >
                      {loading ? "সেভ হচ্ছে..." : "পাসওয়ার্ড সেভ করুন"}
                    </Button>
                  </form>
                )}
              </div>

              {stage === "form" && !forgotMode && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">অথবা</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={handleGoogle}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                    </svg>
                    Google দিয়ে {tab === "login" ? "লগিন" : "সাইন আপ"}
                  </Button>

                  <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                    একাউন্ট তৈরি করার মাধ্যমে, আপনি{" "}
                    <a href="/terms-of-service" className="underline hover:text-foreground">
                      টার্মস এবং শর্তাবলী
                    </a>{" "}
                    এবং{" "}
                    <a href="/privacy-policy" className="underline hover:text-foreground">
                      প্রাইভেসি পলিসি
                    </a>{" "}
                    এর সাথে সম্মতি প্রকাশ করছেন।
                  </p>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader className="items-center text-center">
            <div className="mb-2 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <AlertDialogTitle className="text-center text-base font-semibold">
              আপনি কি লগইন/রেজিস্টার প্রসেস থেকে বের হতে চাচ্ছেন?
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              বের হয়ে গেলে আপনার এই মুহূর্তের প্রগ্রেস হারিয়ে যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <AlertDialogAction
              onClick={confirmDiscard}
              className="bg-background text-foreground border border-border hover:bg-secondary"
            >
              হ্যাঁ, বের হবো
            </AlertDialogAction>
            <AlertDialogCancel className="mt-0 bg-brand text-brand-foreground hover:bg-brand/90">
              বের হবো না
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
