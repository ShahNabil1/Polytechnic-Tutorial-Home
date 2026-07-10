import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { UserIdentity } from "@supabase/supabase-js";
import { ensureReauth } from "@/lib/reauth";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 3;
const LOCKOUT_MINUTES = 5;

function bnToEnDigits(s: string): string {
  const map: Record<string, string> = {
    "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9",
  };
  return s.replace(/[০-৯]/g, (d) => map[d] ?? d);
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

export function LinkedAccountsCard() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [phoneStage, setPhoneStage] = useState<"idle" | "otp">("idle");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Resend / cooldown / lockout — mirrors auth-drawer.
  const [cooldown, setCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockRemaining, setLockRemaining] = useState(0);
  const tickRef = useRef<number | null>(null);

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

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }
  function resetOtpControls() {
    setCooldown(0);
    setResendCount(0);
    setLockedUntil(null);
    setLockRemaining(0);
  }


  async function refresh() {
    const { data } = await supabase.auth.getUserIdentities();
    setIdentities(data?.identities ?? []);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  const googleIdentity = identities.find((i) => i.provider === "google");
  const phoneIdentity = identities.find((i) => i.provider === "phone");
  const emailIdentity = identities.find((i) => i.provider === "email");

  async function handleLinkGoogle() {
    if (!(await ensureReauth())) return;
    setLinkingGoogle(true);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/sdash/profile` },
      });
      if (error) throw error;
      // Some Supabase versions don't auto-redirect; do it manually.
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      setLinkingGoogle(false);
      const msg = e instanceof Error ? e.message : String(e);
      if (/manual.*link|linking.*disabled|not.*enabled/i.test(msg)) {
        toast.error(
          "Google লিংক করতে Supabase Dashboard → Authentication → Settings-এ 'Manual Linking' এনাবল করতে হবে।",
        );
      } else if (/already.*linked|identity.*exists/i.test(msg)) {
        toast.error("এই Google একাউন্টটা অন্য একজন ইউজারের সাথে অলরেডি লিংক করা।");
      } else {
        toast.error("Google লিংক করা যায়নি: " + msg);
      }
    }
  }

  async function handleUnlinkGoogle() {
    if (!googleIdentity) return;
    if (identities.length < 2) {
      toast.error("এটাই একমাত্র লগইন মেথড — আনলিংক করা যাবে না");
      return;
    }
    if (!confirm("Google একাউন্ট আনলিংক করবেন?")) return;
    if (!(await ensureReauth())) return;
    const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
    if (error) toast.error(error.message);
    else {
      toast.success("Google আনলিংক হয়েছে");
      await refresh();
    }
  }

  async function handleSendPhoneOtp() {
    if (!isValidBdMobile(phoneRaw)) {
      toast.error("সঠিক ১১ ডিজিটের নাম্বার দিন");
      return;
    }
    if (!(await ensureReauth())) return;
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: normalizePhone(phoneRaw) });
      if (error) throw error;
      setPhoneStage("otp");
      toast.success("OTP পাঠানো হয়েছে");
      resetOtpControls();
      startCooldown();
    } catch (e) {
      toast.error("OTP পাঠানো যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleResendPhoneOtp() {
    if (cooldown > 0 || lockedUntil) return;
    if (resendCount >= MAX_RESENDS) {
      const until = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
      setLockedUntil(until);
      setLockRemaining(LOCKOUT_MINUTES * 60);
      toast.error(`অনেক বার রিসেন্ড হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন।`);
      return;
    }
    setPhoneLoading(true);
    try {
      // For phone-change flow the correct resend type is "phone_change".
      const { error } = await supabase.auth.resend({
        type: "phone_change",
        phone: normalizePhone(phoneRaw),
      });
      if (error) throw error;
      setResendCount((n) => n + 1);
      startCooldown();
      toast.success(`OTP আবার পাঠানো হয়েছে (${resendCount + 1}/${MAX_RESENDS})`);
    } catch (e) {
      toast.error("রিসেন্ড ব্যর্থ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (otp.length < 4) {
      toast.error("OTP কোড দিন");
      return;
    }
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phoneRaw),
        token: otp,
        type: "phone_change",
      });
      if (error) throw error;
      toast.success("ফোন নাম্বার লিংক হয়েছে");
      setPhoneStage("idle");
      setPhoneRaw("");
      setOtp("");
      resetOtpControls();
      await refresh();
    } catch (e) {
      toast.error("OTP ভুল বা মেয়াদ শেষ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPhoneLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <Link2 className="size-4 text-brand" />
        Linked accounts
      </h2>

      <div className="space-y-3">
        {/* Google / Email */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Mail className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {googleIdentity ? "Google" : emailIdentity ? "Email" : "Email / Google"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {googleIdentity?.identity_data?.email ||
                  emailIdentity?.identity_data?.email ||
                  "কোনো ইমেইল লিংক করা নেই"}
              </div>
            </div>
          </div>
          {googleIdentity ? (
            <button
              type="button"
              onClick={handleUnlinkGoogle}
              className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <Unlink className="size-3.5" />
              আনলিংক
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLinkGoogle}
              disabled={linkingGoogle}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {linkingGoogle && <Loader2 className="size-3.5 animate-spin" />}
              Google দিয়ে লিংক করুন
            </button>
          )}
        </div>

        {/* Phone */}
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Phone className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Phone</div>
                <div className="truncate text-xs text-muted-foreground">
                  {phoneIdentity?.identity_data?.phone || "কোনো ফোন নাম্বার লিংক করা নেই"}
                </div>
              </div>
            </div>
            {!phoneIdentity && phoneStage === "idle" && (
              <button
                type="button"
                onClick={() => setPhoneStage("otp")}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground hover:bg-brand/90"
              >
                ফোন যোগ করুন
              </button>
            )}
          </div>

          {!phoneIdentity && phoneStage === "otp" && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={phoneLoading}
                  className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-brand-foreground disabled:opacity-60"
                >
                  {phoneLoading ? <Loader2 className="size-4 animate-spin" /> : "OTP পাঠান"}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="OTP কোড"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={phoneLoading || otp.length < 4}
                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                >
                  ভেরিফাই
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStage("idle");
                    setPhoneRaw("");
                    setOtp("");
                    resetOtpControls();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  বাতিল
                </button>
                {cooldown > 0 || resendCount > 0 || lockedUntil ? (
                  lockedUntil ? (
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
                      onClick={handleResendPhoneOtp}
                      className="text-destructive hover:underline"
                    >
                      লিমিট পৌঁছেছে
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendPhoneOtp}
                      disabled={phoneLoading}
                      className="text-brand hover:underline disabled:opacity-60"
                    >
                      কোড আবার পাঠান ({MAX_RESENDS - resendCount} বার বাকি)
                    </button>
                  )
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
