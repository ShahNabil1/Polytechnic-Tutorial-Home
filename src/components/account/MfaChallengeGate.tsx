/**
 * MFA (TOTP) route gate.
 * Keeps protected workspace/student dashboards hidden until aal2 is verified,
 * then renders the 2FA prompt inside the shared auth drawer.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { retrySupabaseAuth } from "@/lib/auth-reliability";
import { AuthDrawer } from "@/components/auth-drawer";

export function MfaChallengeGate({ children }: { children: ReactNode }) {
  const [need, setNeed] = useState<null | { factorId: string }>(null);
  const [checking, setChecking] = useState(true);
  const checkingRef = useRef(false);

  async function check() {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const { data: sess } = await retrySupabaseAuth(() => supabase.auth.getSession());
      if (!sess.session) {
        setNeed(null);
        setChecking(false);
        return;
      }
      const { data: aal } = await retrySupabaseAuth(() => supabase.auth.mfa.getAuthenticatorAssuranceLevel());
      if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") {
        setNeed(null);
        setChecking(false);
        return;
      }
      const { data: factors } = await retrySupabaseAuth(() => supabase.auth.mfa.listFactors());
      const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (totp) setNeed({ factorId: totp.id });
      else setNeed(null);
      setChecking(false);
    } catch {
      setNeed(null);
      setChecking(false);
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "MFA_CHALLENGE_VERIFIED") {
        window.setTimeout(() => void check(), 100);
      }
      if (event === "SIGNED_OUT") setNeed(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!need) return <>{children}</>;

  return (
    <div className="min-h-[60vh]">
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div className="max-w-sm text-sm text-muted-foreground">টু-ফ্যাক্টর ভেরিফিকেশন প্রয়োজন।</div>
      </div>
      <AuthDrawer
        open={true}
        onOpenChange={(value) => {
          if (!value) return;
        }}
        sessionMfaFactorId={need.factorId}
        onSessionMfaComplete={() => {
          setNeed(null);
          setChecking(false);
          window.setTimeout(() => void check(), 50);
        }}
        onSessionMfaCancel={() => setNeed(null)}
      />
    </div>
  );
}
