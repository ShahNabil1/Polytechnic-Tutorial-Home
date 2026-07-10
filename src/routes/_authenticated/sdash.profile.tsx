import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User as UserIcon } from "lucide-react";
import { PasskeysCard } from "@/components/account/PasskeysCard";
import { LinkedAccountsCard } from "@/components/account/LinkedAccountsCard";
import { PasswordCard } from "@/components/account/PasswordCard";
import { SessionsCard } from "@/components/account/SessionsCard";
import { ReauthDialogHost } from "@/components/account/ReauthDialog";

export const Route = createFileRoute("/_authenticated/sdash/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setFullName(data?.full_name ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("সেভ করা যায়নি: " + error.message);
    else toast.success("প্রোফাইল আপডেট হয়েছে");
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">প্রোফাইল ও সিকিউরিটি</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ব্যক্তিগত তথ্য, লগইন মেথড ও একটিভ সেশন ম্যানেজ করুন।
        </p>
      </div>

      {/* Basic profile */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <UserIcon className="size-4 text-brand" />
          ব্যক্তিগত তথ্য
        </h2>
        <div className="mb-5 flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-16 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="grid size-16 place-items-center rounded-full bg-secondary">
              <UserIcon className="size-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="text-base font-semibold">{fullName || "নাম যোগ করুন"}</div>
            <div className="text-xs text-muted-foreground">{user?.phone || user?.email || user?.id}</div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">পূর্ণ নাম</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="আপনার নাম"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">অ্যাভাটার URL</span>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="https://..."
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              সেভ করুন
            </button>
          </div>
        </form>
      </section>

      <LinkedAccountsCard />
      <PasswordCard />
      <PasskeysCard />
      <SessionsCard />
    </div>
  );
}
