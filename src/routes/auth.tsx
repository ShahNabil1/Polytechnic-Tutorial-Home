import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "সাইন ইন / সাইন আপ — Polytechnic Tutorial Home" },
      { name: "description", content: "Polytechnic Tutorial Home অ্যাকাউন্টে সাইন ইন করুন বা নতুন অ্যাকাউন্ট তৈরি করুন।" },
    ],
  }),
  component: AuthPage,
});

type SignupStage = "form" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold">স্বাগতম</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          আপনার অ্যাকাউন্টে সাইন ইন করুন অথবা নতুন অ্যাকাউন্ট তৈরি করুন
        </p>

        <GoogleButton />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">অথবা</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">সাইন ইন</TabsTrigger>
            <TabsTrigger value="signup">সাইন আপ</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="mt-4">
            <SignInForm />
          </TabsContent>
          <TabsContent value="signup" className="mt-4">
            <SignUpFlow />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/` },
        });
        if (error) {
          toast.error(error.message);
          setLoading(false);
        }
      }}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
      </svg>
      Google দিয়ে সাইন ইন
    </Button>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) return toast.error(error.message);
        toast.success("সাইন ইন সফল");
        navigate({ to: "/" });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="signin-email">ইমেইল</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">পাসওয়ার্ড</Label>
          <Link to="/forgot-password" className="text-xs text-brand hover:underline">
            পাসওয়ার্ড ভুলে গেছেন?
          </Link>
        </div>
        <Input id="signin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "অপেক্ষা করুন..." : "সাইন ইন"}
      </Button>
    </form>
  );
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88")) return "+" + digits;
  if (digits.startsWith("0")) return "+88" + digits;
  return "+88" + digits;
}

function SignUpFlow() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<SignupStage>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";

  if (stage === "otp") {
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
          if (error) {
            setLoading(false);
            return toast.error(error.message);
          }
          // Mark verified in profile
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("profiles").update({ phone_verified: true, phone }).eq("id", user.id);
          }
          setLoading(false);
          toast.success("ফোন নাম্বার ভেরিফাই হয়েছে");
          navigate({ to: "/" });
        }}
      >
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <strong>{phone}</strong> নাম্বারে OTP পাঠানো হয়েছে।
        </div>
        <div className="space-y-2">
          <Label htmlFor="otp">৬-ডিজিট OTP কোড</Label>
          <Input id="otp" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading || otp.length < 4}>
          {loading ? "যাচাই করা হচ্ছে..." : "ভেরিফাই করুন"}
        </Button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOtp({ phone });
            if (error) return toast.error(error.message);
            toast.success("OTP আবার পাঠানো হয়েছে");
          }}
        >
          কোড পাননি? আবার পাঠান
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
        setLoading(true);

        // 1. Sign up with email + password (auto-creates profile via trigger)
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          phone,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signUpErr) {
          setLoading(false);
          return toast.error(signUpErr.message);
        }
        // If email confirmation is disabled, user is signed in; otherwise we still can send OTP
        if (!signUpData.session) {
          // Try sign in so we have session to send OTP against the new phone
          await supabase.auth.signInWithPassword({ email, password }).catch(() => {});
        }

        // 2. Send phone OTP
        const { error: otpErr } = await supabase.auth.signInWithOtp({ phone });
        setLoading(false);
        if (otpErr) return toast.error("OTP পাঠানো যায়নি: " + otpErr.message);
        toast.success("OTP পাঠানো হয়েছে");
        setStage("otp");
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="signup-name">পূর্ণ নাম</Label>
        <Input id="signup-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">ইমেইল</Label>
        <Input id="signup-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-phone">ফোন নাম্বার</Label>
        <Input
          id="signup-phone"
          type="tel"
          placeholder="01XXXXXXXXX"
          required
          value={phoneRaw}
          onChange={(e) => setPhoneRaw(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">বাংলাদেশী নাম্বার — OTP পাঠানো হবে</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">পাসওয়ার্ড</Label>
        <Input id="signup-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "অ্যাকাউন্ট তৈরি হচ্ছে..." : "সাইন আপ ও OTP পাঠান"}
      </Button>
    </form>
  );
}
