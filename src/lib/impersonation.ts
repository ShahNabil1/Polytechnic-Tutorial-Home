import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/lib/admin-users.functions";

const KEY = "impersonation.admin.v1";

type Saved = {
  admin_refresh_token: string;
  admin_user_id: string;
  admin_email: string | null;
  target_user_id: string;
  target_email: string;
  target_label: string;
  started_at: string;
};

export function getImpersonationState(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function setState(s: Saved | null) {
  if (typeof window === "undefined") return;
  if (!s) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("impersonation:changed"));
}

export async function beginImpersonation(opts: {
  user_id: string;
  targetLabel: string;
}): Promise<{ redirectTo: string }> {
  const { data: adminSession } = await supabase.auth.getSession();
  const s = adminSession.session;
  if (!s?.refresh_token) throw new Error("Admin session not found");

  const res = await startImpersonation({ data: { user_id: opts.user_id } });

  // Save admin session BEFORE switching
  setState({
    admin_refresh_token: s.refresh_token,
    admin_user_id: s.user.id,
    admin_email: s.user.email ?? null,
    target_user_id: opts.user_id,
    target_email: res.email,
    target_label: opts.targetLabel,
    started_at: new Date().toISOString(),
  });

  // Consume the magic link → creates a fresh session as the target user.
  // When using token_hash, Supabase requires ONLY { token_hash, type } — passing email throws
  // "Only the token_hash and type should be provided".
  const { error } = await supabase.auth.verifyOtp({
    token_hash: res.hashed_token,
    type: "magiclink",
  });
  if (error) {
    setState(null);
    throw error;
  }

  const redirectTo =
    res.primary_role === "student"
      ? "/sdash"
      : res.primary_role === "instructor"
        ? "/instructor"
        : "/workspace";
  return { redirectTo };
}

export async function endImpersonation(): Promise<{ redirectTo: string; adminUserId: string } | null> {
  const state = getImpersonationState();
  if (!state) return null;
  try {
    // Sign out impersonation session locally (do NOT global-sign-out the target)
    await supabase.auth.signOut({ scope: "local" } as any).catch(() => {});
  } catch {}
  const { error } = await supabase.auth.refreshSession({ refresh_token: state.admin_refresh_token });
  if (error) {
    // Even on failure, clear state so the user can re-login manually
    setState(null);
    throw error;
  }
  setState(null);
  return { redirectTo: "/workspace", adminUserId: state.admin_user_id };
}
