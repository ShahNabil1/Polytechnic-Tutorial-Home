import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AuthDrawer } from "@/components/auth-drawer";
import { SessionEnforcer } from "@/components/account/SessionEnforcer";
import { InactivityLogout } from "@/components/InactivityLogout";
import { MfaChallengeGate } from "@/components/account/MfaChallengeGate";
import { Loader2, Lock } from "lucide-react";
import { getMyAccountStatus } from "@/lib/account-status.functions";
import { signOutSafely } from "@/lib/auth-reliability";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) setDrawerOpen(true);
  }, [loading, user]);

  // Active-account gate: sign out immediately if the internal account has
  // been deactivated by an admin. Runs on mount and every 45s while mounted.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    async function check() {
      try {
        const res = await getMyAccountStatus();
        if (cancelled) return;
        if (res && (res as any).active === false) {
          toast.error("আপনার একাউন্টটি ডিএ্যাক্টিভ করা হয়েছে");
          await signOutSafely();
        }
      } catch {
        /* transient — ignore */
      }
    }
    check();
    const t = window.setInterval(check, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [loading, user]);


  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">
              <Lock className="size-6 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold">সাইন ইন প্রয়োজন</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              ড্যাশবোর্ড দেখতে হলে প্রথমে সাইন ইন করতে হবে।
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
            >
              সাইন ইন করুন
            </button>
          </div>
        </div>
        <AuthDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
    );
  }

  return (
    <MfaChallengeGate>
      <Outlet />
      <SessionEnforcer />
      <InactivityLogout />
    </MfaChallengeGate>
  );
}
