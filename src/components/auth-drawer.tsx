import { useState } from "react";
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
import { AlertCircle } from "lucide-react";

type Tab = "login" | "signup";
type Stage = "phone" | "otp";

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

// BD mobile: 11 digits starting with 013-019
function isValidBdMobile(raw: string): boolean {
  const digits = bnToEnDigits(raw).replace(/\D/g, "");
  return /^01[3-9]\d{8}$/.test(digits);
}

function errMsg(e: unknown, fallback = "কিছু ভুল হয়েছে, আবার চেষ্টা করুন"): string {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const anyE = e as { message?: string; error_description?: string; msg?: string };
    return anyE.message || anyE.error_description || anyE.msg || fallback;
  }
  return fallback;
}


export function AuthDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("login");
  const [stage, setStage] = useState<Stage>("phone");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const inProgress = phoneRaw.length > 0 || otp.length > 0 || fullName.length > 0;

  function resetAll() {
    setPhoneRaw("");
    setFullName("");
    setOtp("");
    setStage("phone");
    setTab("login");
    setPhoneError(null);
  }

  function requestClose() {
    if (inProgress) {
      setConfirmClose(true);
    } else {
      onOpenChange(false);
    }
  }

  function confirmDiscard() {
    setConfirmClose(false);
    resetAll();
    onOpenChange(false);
  }

  function handlePhoneChange(v: string) {
    // Convert Bangla/Arabic digits to English, keep only digits, cap at 11
    const digits = bnToEnDigits(v).replace(/\D/g, "").slice(0, 11);
    setPhoneRaw(digits);
    if (phoneError) setPhoneError(null);
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) {
        setLoading(false);
        toast.error(errMsg(error));
      }
    } catch (e) {
      setLoading(false);
      toast.error(errMsg(e));
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    if (!phoneRaw) {
      setPhoneError("ফোন নাম্বার দিন");
      return;
    }
    if (!isValidBdMobile(phoneRaw)) {
      setPhoneError("সঠিক ১১ ডিজিটের নাম্বার দিন (013, 014, 015, 016, 017, 018, 019 দিয়ে শুরু)");
      return;
    }
    if (tab === "signup" && !fullName.trim()) {
      setPhoneError("আপনার পূর্ণ নাম দিন");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: tab === "signup",
          data: tab === "signup" ? { full_name: fullName } : undefined,
        },
      });
      setLoading(false);
      if (error) {
        const msg = (errMsg(error) || "").toLowerCase();
        // No account found for this number (login flow)
        if (tab === "login" && (msg.includes("signups not allowed") || msg.includes("signup") || msg.includes("not found") || msg.includes("user not"))) {
          setPhoneError("এই নাম্বারে কোনো একাউন্ট নেই। নতুন একাউন্ট খুলুন অথবা রেজিস্টার্ড নাম্বার দিন।");
          return;
        }
        // Existing account (signup flow)
        if (tab === "signup" && (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))) {
          setPhoneError("এই নাম্বারে ইতিমধ্যে একাউন্ট আছে। লগইন ট্যাব থেকে লগইন করুন।");
          return;
        }
        setPhoneError(errMsg(error));
        return;
      }
      toast.success("OTP পাঠানো হয়েছে");
      setStage("otp");
    } catch (err) {
      setLoading(false);
      setPhoneError(errMsg(err));
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) {
        setLoading(false);
        return toast.error(errMsg(error));
      }
      const { data: userData } = await supabase.auth.getUser();
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
      setLoading(false);
      toast.success(tab === "signup" ? "একাউন্ট তৈরি হয়েছে" : "সাইন ইন সফল");
      resetAll();
      onOpenChange(false);
    } catch (err) {
      setLoading(false);
      toast.error(errMsg(err));
    }
  }


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
          className="w-full sm:max-w-md flex flex-col gap-0 p-0"
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
              {/* Auth card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 text-center">
                  <h2 className="text-lg font-semibold">
                    {tab === "login" ? "একাউন্টে লগিন করুন" : "নতুন একাউন্ট তৈরি করুন"}
                  </h2>
                </div>

                {/* Side-by-side tabs */}
                <div className="mb-4 grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
                  {(["login", "signup"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        setStage("phone");
                        setOtp("");
                        setPhoneError(null);
                      }}
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

                {stage === "phone" && (
                  <form className="space-y-4" onSubmit={handleSendOtp}>
                    {tab === "signup" && (
                      <div className="space-y-2">
                        <Label htmlFor="auth-name">পূর্ণ নাম</Label>
                        <Input
                          id="auth-name"
                          placeholder="আপনার নাম"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="auth-phone">ফোন নাম্বার দিন</Label>
                      <div
                        className={cn(
                          "flex overflow-hidden rounded-md border focus-within:ring-2",
                          phoneError
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
                          placeholder="01XXXXXXXXX"
                          value={phoneRaw}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          maxLength={11}
                          required
                          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      {phoneError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{phoneError}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                      disabled={loading}
                    >
                      {loading ? "পাঠানো হচ্ছে..." : tab === "login" ? "লগইন" : "সাইন আপ"}
                    </Button>
                  </form>
                )}

                {stage === "otp" && (
                  <form className="space-y-4" onSubmit={handleVerifyOtp}>
                    <div className="rounded-lg bg-muted/60 p-3 text-sm">
                      <strong>+88{phoneRaw}</strong> নাম্বারে OTP পাঠানো হয়েছে
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auth-otp">৬-ডিজিট OTP কোড</Label>
                      <Input
                        id="auth-otp"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || otp.length < 4}
                    >
                      {loading ? "যাচাই করা হচ্ছে..." : "ভেরিফাই করুন"}
                    </Button>
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setStage("phone");
                          setOtp("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ← নাম্বার পরিবর্তন
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const { error } = await supabase.auth.signInWithOtp({
                            phone,
                            options: { shouldCreateUser: tab === "signup" },
                          });
                          if (error) return toast.error(error.message);
                          toast.success("OTP আবার পাঠানো হয়েছে");
                        }}
                        className="text-brand hover:underline"
                      >
                        কোড আবার পাঠান
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {stage === "phone" && (
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
