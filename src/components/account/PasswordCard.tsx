import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function PasswordCard() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const idents = data.user?.identities ?? [];
      // "password" identity is stored under email or phone provider with a password
      // Supabase exposes providers list in user.app_metadata.providers
      const providers = (data.user?.app_metadata?.providers as string[] | undefined) ?? [];
      const passwordSet = providers.includes("email") || providers.includes("phone");
      setHasPassword(passwordSet && idents.some((i) => i.provider === "phone" || i.provider === "email"));
      setPhone(data.user?.phone ?? null);
      setEmail(data.user?.email ?? null);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে");
    if (next !== confirm) return toast.error("পাসওয়ার্ড দুটো মিলছে না");

    setSaving(true);
    try {
      if (hasPassword) {
        // Reauth first
        const reauth = phone
          ? await supabase.auth.signInWithPassword({ phone, password: current })
          : email
            ? await supabase.auth.signInWithPassword({ email, password: current })
            : null;
        if (!reauth || reauth.error) {
          toast.error("বর্তমান পাসওয়ার্ড ভুল");
          setSaving(false);
          return;
        }
      } else if (!phone) {
        toast.error("পাসওয়ার্ড সেট করার আগে ফোন নাম্বার লিংক করুন");
        setSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success(hasPassword ? "পাসওয়ার্ড আপডেট হয়েছে" : "পাসওয়ার্ড সেট হয়েছে");
      setCurrent("");
      setNext("");
      setConfirm("");
      setHasPassword(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (hasPassword === null) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        <Lock className="size-4 text-brand" />
        {hasPassword ? "পাসওয়ার্ড পরিবর্তন" : "পাসওয়ার্ড সেট করুন"}
      </h2>

      {!hasPassword && !phone && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          পাসওয়ার্ড সেট করার আগে উপরের সেকশন থেকে ফোন নাম্বার লিংক করুন।
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {hasPassword && (
          <PwField label="বর্তমান পাসওয়ার্ড" value={current} onChange={setCurrent} show={show} onToggle={() => setShow((s) => !s)} autoComplete="current-password" />
        )}
        <PwField label="নতুন পাসওয়ার্ড" value={next} onChange={setNext} show={show} onToggle={() => setShow((s) => !s)} autoComplete="new-password" />
        <PwField label="নতুন পাসওয়ার্ড কনফার্ম" value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow((s) => !s)} autoComplete="new-password" />

        <button
          type="submit"
          disabled={saving || (!hasPassword && !phone)}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {hasPassword ? "পাসওয়ার্ড আপডেট" : "পাসওয়ার্ড সেট"}
        </button>
      </form>
    </section>
  );
}

function PwField({
  label, value, onChange, show, onToggle, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm outline-none focus:border-brand"
          placeholder="••••••••"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </label>
  );
}
