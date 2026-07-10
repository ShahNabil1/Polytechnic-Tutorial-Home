import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "পাসওয়ার্ড রিসেট — Polytechnic Tutorial Home" },
      { name: "description", content: "ফোন নাম্বারে OTP পাঠিয়ে আপনার পাসওয়ার্ড রিসেট করুন।" },
    ],
  }),
  component: ForgotPasswordPage,
});

type Stage = "phone" | "otp" | "reset";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88")) return "+" + digits;
  if (digits.startsWith("0")) return "+88" + digits;
  return "+88" + digits;
}

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("phone");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold">পাসওয়ার্ড রিসেট</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {stage === "phone" && "আপনার রেজিস্টার্ড ফোন নাম্বার দিন"}
          {stage === "otp" && "OTP কোড দিন"}
          {stage === "reset" && "নতুন পাসওয়ার্ড সেট করুন"}
        </p>

        {stage === "phone" && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.auth.signInWithOtp({ phone });
              setLoading(false);
              if (error) return toast.error(error.message);
              toast.success("OTP পাঠানো হয়েছে");
              setStage("otp");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fp-phone">ফোন নাম্বার</Label>
              <Input id="fp-phone" type="tel" placeholder="01XXXXXXXXX" required value={phoneRaw} onChange={(e) => setPhoneRaw(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "পাঠানো হচ্ছে..." : "OTP পাঠান"}
            </Button>
          </form>
        )}

        {stage === "otp" && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
              setLoading(false);
              if (error) return toast.error(error.message);
              toast.success("ভেরিফাই সফল");
              setStage("reset");
            }}
          >
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <strong>{phone}</strong> নাম্বারে OTP পাঠানো হয়েছে
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-otp">৬-ডিজিট OTP</Label>
              <Input id="fp-otp" inputMode="numeric" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length < 4}>
              {loading ? "যাচাই করা হচ্ছে..." : "ভেরিফাই করুন"}
            </Button>
          </form>
        )}

        {stage === "reset" && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (newPassword.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
              setLoading(true);
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              setLoading(false);
              if (error) return toast.error(error.message);
              toast.success("পাসওয়ার্ড আপডেট হয়েছে");
              navigate({ to: "/" });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fp-new">নতুন পাসওয়ার্ড</Label>
              <Input id="fp-new" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "আপডেট হচ্ছে..." : "পাসওয়ার্ড আপডেট করুন"}
            </Button>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <Link to="/auth" className="text-brand hover:underline">
            সাইন ইন পেজে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
}
