import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProfileRow } from "@/lib/profile";

const PROFILE_CACHE_TTL_SEC = 10 * 60;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withCache } = await import("@/lib/cache.server");
    const { profileCacheKey } = await import("@/lib/profile-cache.server");
    return withCache<ProfileRow | null>(
      profileCacheKey(context.userId),
      PROFILE_CACHE_TTL_SEC,
      async () => {
        const { data, error } = await context.supabase
          .from("profiles")
          .select("*")
          .eq("id", context.userId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return (data as ProfileRow | null) ?? null;
      },
    );
  });

const UpdateProfileSchema = z.object({
  full_name: z.string().max(200).nullable().optional(),
  avatar_url: z.string().max(1000).nullable().optional(),
  institute_name: z.string().max(200).nullable().optional(),
  department_name: z.string().max(200).nullable().optional(),
  current_semester: z.string().max(40).nullable().optional(),
  board_roll: z.string().max(60).nullable().optional(),
  registration_no: z.string().max(60).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      payload[k] = typeof v === "string" ? v.trim() || null : v;
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(payload as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    const { invalidateProfileCache } = await import("@/lib/profile-cache.server");
    await invalidateProfileCache(context.userId);
    return { ok: true };
  });
