/**
 * Server-side password verification for step-up reauth.
 * Uses a throw-away publishable client so verifying doesn't clobber the
 * user's active browser session/tokens.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Schema = z.object({ password: z.string().min(1).max(200) });

export const verifyPasswordReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ context, data }) => {
    const claims = context.claims as { email?: string; phone?: string };
    const email = claims.email;
    const phone = claims.phone;
    if (!email && !phone) {
      return { ok: false as const, reason: "no-credential" as const };
    }

    const temp = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );

    const { data: result, error } = phone
      ? await temp.auth.signInWithPassword({ phone, password: data.password })
      : await temp.auth.signInWithPassword({ email: email!, password: data.password });

    if (error || !result?.user || result.user.id !== context.userId) {
      return { ok: false as const, reason: "invalid" as const };
    }
    // Best-effort cleanup; persistSession:false means nothing was persisted anyway.
    await temp.auth.signOut().catch(() => {});
    return { ok: true as const };
  });
