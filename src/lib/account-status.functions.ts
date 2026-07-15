/**
 * Lightweight self-check server fn: is the calling account still active?
 * Used by the authenticated layout to sign out deactivated users immediately,
 * regardless of whether Supabase's ban_duration is enforced on the token.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("internal_profiles")
      .select("is_active")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Students / users with no internal_profiles row are always active.
    const active = data == null ? true : (data as any).is_active !== false;
    return { active };
  });
