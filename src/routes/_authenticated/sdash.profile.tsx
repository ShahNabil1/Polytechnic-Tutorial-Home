import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sdash/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error(error);
      setFullName(data?.full_name ?? "");
      setEmail(data?.email ?? user.email ?? "");
      setPhone(data?.phone ?? user.phone ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        email: email || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("সেভ করা যায়নি: " + error.message);
      return;
    }
    toast.success("প্রোফাইল আপডেট হয়েছে");
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">প্রোফাইল</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার ব্যক্তিগত তথ্য ও অ্যাকাউন্ট সেটিংস।
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="size-16 rounded-full object-cover ring-1 ring-border"
            />
          ) : (
            <div className="grid size-16 place-items-center rounded-full bg-secondary">
              <UserIcon className="size-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="text-base font-semibold">
              {fullName || "নাম যোগ করুন"}
            </div>
            <div className="text-xs text-muted-foreground">
              {phone || email || user?.id}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
          <Field label="পূর্ণ নাম">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="আপনার নাম"
            />
          </Field>

          <Field label="ফোন নম্বর">
            <input
              type="text"
              value={phone}
              disabled
              className="w-full rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm text-muted-foreground"
            />
          </Field>

          <Field label="ইমেইল">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="you@example.com"
            />
          </Field>

          <Field label="অ্যাভাটার URL">
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="https://..."
            />
          </Field>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              সেভ করুন
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
