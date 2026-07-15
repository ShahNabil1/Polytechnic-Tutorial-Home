import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { changeMyPrimaryEmail } from "@/lib/email-change.functions";
import { ensureReauth } from "@/lib/reauth";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { retrySupabaseAuth } from "@/lib/auth-reliability";

/**
 * Change primary sign-in email for internal (employee/instructor/super_admin) users.
 * Guarded by step-up reauth. Immediately updates the auth email and unlinks
 * any Google identity that used the old address so it can no longer sign in.
 */
export function EmailChangeCard() {
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const runChange = useServerFn(changeMyPrimaryEmail);

  async function refresh() {
    const { data } = await retrySupabaseAuth(() => supabase.auth.getUser());
    setCurrentEmail(data.user?.email ?? "");
  }
  useEffect(() => {
    refresh();
  }, []);

  const clean = newEmail.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && clean !== currentEmail.toLowerCase();
  const typedMatch = confirmText.trim().toLowerCase() === clean && clean.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !typedMatch) return;
    const ok = await confirmDialog({
      variant: "danger",
      title: "প্রাইমারি ইমেইল পরিবর্তন",
      description: `আপনার সাইন-ইন ইমেইল "${currentEmail}" থেকে "${clean}"-এ পরিবর্তন হবে। পুরাতন ইমেইল দিয়ে Google লগইন আর কাজ করবে না। নিশ্চিত?`,
      confirmLabel: "হ্যাঁ, পরিবর্তন করুন",
      cancelLabel: "বাতিল",
    });
    if (!ok) return;
    if (!(await ensureReauth())) return;

    setBusy(true);
    try {
      const res = await runChange({ data: { newEmail: clean } });
      // Refresh local session so the client sees the updated email immediately.
      await retrySupabaseAuth(() => supabase.auth.refreshSession());
      toast.success("ইমেইল আপডেট হয়েছে", {
        description:
          res?.unlinked && res.unlinked.length > 0
            ? `পুরাতন ${res.unlinked.join(", ")} লগইন আনলিংক করা হয়েছে।`
            : "নতুন ইমেইল দিয়ে এখন থেকে সাইন-ইন করা যাবে।",
      });
      setNewEmail("");
      setConfirmText("");
      await refresh();
    } catch (err) {
      toast.error("পরিবর্তন ব্যর্থ", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold tracking-tight">
        <Mail className="size-4 text-indigo-600" />
        Primary sign-in email
      </h2>
      <p className="mb-4 text-xs font-medium text-slate-500">
        এই ইমেইল দিয়ে আপনি সাইন-ইন করেন (Google সহ)। পরিবর্তনের পর পুরাতন
        ইমেইল-এর Google একাউন্ট আর এই একাউন্টে ঢুকতে পারবে না।
      </p>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Current
        </div>
        <div className="font-medium text-slate-900">{currentEmail || "—"}</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            New email
          </span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
            required
            disabled={busy}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            নিশ্চিত করতে নতুন ইমেইলটি আবার টাইপ করুন
          </span>
          <input
            type="email"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Retype new email"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
            disabled={busy || !valid}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={busy || !valid || !typedMatch}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Change email
          </button>
          {valid && typedMatch && !busy && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Ready
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
