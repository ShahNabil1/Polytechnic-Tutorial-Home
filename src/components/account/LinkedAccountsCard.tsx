import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { UserIdentity } from "@supabase/supabase-js";
import { ensureReauth } from "@/lib/reauth";

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
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/sdash/profile` },
      });
      if (error) throw error;
    } catch (e) {
      setLinkingGoogle(false);
      toast.error("Google লিংক করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleUnlinkGoogle() {
    if (!googleIdentity) return;
    if (identities.length < 2) {
      toast.error("এটাই একমাত্র লগইন মেথড — আনলিংক করা যাবে না");
      return;
    }
    if (!confirm("Google একাউন্ট আনলিংক করবেন?")) return;
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
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: normalizePhone(phoneRaw) });
      if (error) throw error;
      setPhoneStage("otp");
      toast.success("OTP পাঠানো হয়েছে");
    } catch (e) {
      toast.error("OTP পাঠানো যায়নি: " + (e instanceof Error ? e.message : String(e)));
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
              <button
                type="button"
                onClick={() => {
                  setPhoneStage("idle");
                  setPhoneRaw("");
                  setOtp("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                বাতিল
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
