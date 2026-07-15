import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck, Pencil, X, Lock } from "lucide-react";
import { adminChangeTargetContact } from "@/lib/admin-users.functions";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { toEnglishText } from "@/lib/input-filter";

type Props = {
  userId: string;
  currentEmail: string | null;
  currentPhone: string | null; // raw (01XXXXXXXXX), already stripped of 88
  onSaved?: () => void;
};

/**
 * Admin-only card to change target user's primary sign-in email AND/OR phone.
 * - Email/phone update instantly (pre-confirmed).
 * - Old Google identity tied to previous email is unlinked automatically.
 * - All target sessions are revoked; the user must sign in again.
 */
export function AdminContactChangeCard({
  userId,
  currentEmail,
  currentPhone,
  onSaved,
}: Props) {
  const change = useServerFn(adminChangeTargetContact);

  const [editMode, setEditMode] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(currentEmail ?? "");
    setPhone(currentPhone ?? "");
  }, [currentEmail, currentPhone]);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.replace(/\D/g, "").replace(/^88(?=\d{11})/, "");
  const emailChanged =
    !!cleanEmail && cleanEmail !== (currentEmail ?? "").trim().toLowerCase();
  const phoneChanged =
    !!cleanPhone && cleanPhone !== (currentPhone ?? "").trim();
  const emailValid = !cleanEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const phoneValid = !cleanPhone || /^01[3-9][0-9]{8}$/.test(cleanPhone);
  const canSubmit =
    (emailChanged || phoneChanged) && emailValid && phoneValid && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const bits: string[] = [];
    if (emailChanged) bits.push(`ইমেইল: ${currentEmail || "—"} → ${cleanEmail}`);
    if (phoneChanged) bits.push(`ফোন: ${currentPhone || "—"} → ${cleanPhone}`);
    const ok = await confirmDialog({
      variant: "danger",
      title: "কন্ট্যাক্ট পরিবর্তন?",
      description: `${bits.join(" · ")} — পরিবর্তনের পর ইউজার সব ডিভাইস থেকে সাইন আউট হবে${
        emailChanged ? " এবং পুরাতন ইমেইল-এর Google লগইন কাজ করবে না" : ""
      }। নিশ্চিত?`,
      confirmLabel: "হ্যাঁ, পরিবর্তন করুন",
      cancelLabel: "বাতিল",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await change({
        data: {
          user_id: userId,
          email: emailChanged ? cleanEmail : null,
          phone: phoneChanged ? cleanPhone : null,
        },
      });
      toast.success("কন্ট্যাক্ট আপডেট হয়েছে", {
        description:
          (res as any)?.unlinked?.length > 0
            ? `পুরাতন ${(res as any).unlinked.join(", ")} লগইন আনলিংক করা হয়েছে।`
            : "নতুন কন্ট্যাক্ট এখনই কার্যকর।",
      });
      setEditMode(false);
      onSaved?.();
    } catch (err) {
      toast.error("পরিবর্তন ব্যর্থ", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  const locked = !editMode;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <ShieldCheck className="size-4 text-indigo-600" />
          Sign-in Contact (Email &amp; Phone)
          {locked && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
              <Lock className="size-3" /> Locked
            </span>
          )}
        </h2>
        {locked ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEmail(currentEmail ?? "");
              setPhone(currentPhone ?? "");
              setEditMode(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <X className="size-3.5" /> Cancel
          </button>
        )}
      </div>

      <p className="mb-4 text-xs font-medium text-slate-500">
        এই ইমেইল/ফোন দিয়েই ইউজার সাইন-ইন করে। পরিবর্তনের সাথে সাথে পুরাতন Google
        একাউন্ট আর ঢুকতে পারবে না, এবং সব ডিভাইস সাইন আউট হবে।
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            <Mail className="size-3" /> Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(toEnglishText(e.target.value))}
            placeholder="user@example.com"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
            disabled={locked || saving}
          />
          {!locked && cleanEmail && !emailValid && (
            <span className="mt-1 block text-[11px] font-semibold text-red-600">
              সঠিক ইমেইল দিন
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            <Phone className="size-3" /> Phone (BD, 01XXXXXXXXX)
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(toEnglishText(e.target.value).replace(/\D/g, "").slice(0, 13))}
            placeholder="01XXXXXXXXX"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
            disabled={locked || saving}
          />
          {!locked && cleanPhone && !phoneValid && (
            <span className="mt-1 block text-[11px] font-semibold text-red-600">
              সঠিক BD ফোন নাম্বার দিন
            </span>
          )}
        </label>

        {!locked && (
          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Save changes
            </button>
            {!emailChanged && !phoneChanged && (
              <span className="text-xs font-medium text-slate-500">
                কোনো পরিবর্তন নেই
              </span>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
