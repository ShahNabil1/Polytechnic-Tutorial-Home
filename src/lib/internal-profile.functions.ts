import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankDetails = {
  method?: "bank" | "bkash" | "nagad" | "rocket" | "upay";
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  branch?: string;
  routing?: string;
  mfs_number?: string;
};

export type InternalProfile = {
  user_id: string;
  display_id: string;
  address: string | null;
  nid_number: string | null;
  cv_r2_key: string | null;
  nid_front_r2_key: string | null;
  nid_back_r2_key: string | null;
  nid_resubmit_requested_at: string | null;
  nid_resubmit_reason: string | null;
  bank_details: BankDetails | null;
  workplace: string | null;
  job_role: string | null;
  subjects: string[];
  departments: string[];
  mfa_enrolled: boolean;
  first_login_completed: boolean;
  is_active: boolean;
};

export const getMyInternalProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withCache } = await import("@/lib/cache.server");
    const { internalProfileCacheKey } = await import("@/lib/profile-cache.server");
    return withCache<InternalProfile | null>(
      internalProfileCacheKey(context.userId),
      10 * 60,
      async () => {
        const { data, error } = await context.supabase
          .from("internal_profiles")
          .select("*")
          .eq("user_id", context.userId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return (data as InternalProfile | null) ?? null;
      },
    );
  });

export const syncMyPrimaryAuthEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: primaryRole, error: roleError } = await context.supabase.rpc("get_primary_role", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!["employee", "instructor", "super_admin"].includes(String(primaryRole))) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError) throw new Error(userError.message);

    const user = authUser.user as any;
    const currentEmail = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const metadataEmail =
      typeof user?.user_metadata?.email === "string" ? user.user_metadata.email.trim().toLowerCase() : "";
    const identityEmail =
      (user?.identities ?? [])
        .map((identity: any) => identity?.identity_data?.email || identity?.email)
        .find((email: unknown) => typeof email === "string" && email.includes("@"))
        ?.trim()
        .toLowerCase() ?? "";
    const email = currentEmail || metadataEmail || identityEmail;

    if (!email || !z.string().email().safeParse(email).success) {
      return { ok: false, email: null, synced: false, reason: "no_linked_email" as const };
    }

    if (!currentEmail) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        email,
        email_confirm: true,
      } as never);
      if (updateError) throw new Error(updateError.message);
    }

    await supabaseAdmin.from("profiles").update({ email } as never).eq("id", context.userId);
    return { ok: true, email, synced: !currentEmail };
  });

const UpdateSchema = z.object({
  address: z.string().max(500).optional().nullable(),
  nid_number: z.string().max(50).optional().nullable(),
  cv_r2_key: z.string().max(300).optional().nullable(),
  nid_front_r2_key: z.string().max(300).optional().nullable(),
  nid_back_r2_key: z.string().max(300).optional().nullable(),
  bank_details: z
    .object({
      method: z.enum(["bank", "bkash", "nagad", "rocket", "upay"]).optional(),
      account_name: z.string().max(120).optional(),
      account_number: z.string().max(60).optional(),
      bank_name: z.string().max(120).optional(),
      branch: z.string().max(120).optional(),
      routing: z.string().max(60).optional(),
      mfs_number: z.string().max(20).optional(),
    })
    .optional()
    .nullable(),
  workplace: z.string().max(200).optional().nullable(),
  job_role: z.string().max(120).optional().nullable(),
  subjects: z.array(z.string().max(120)).max(50).optional(),
  departments: z.array(z.string().max(120)).max(50).optional(),
  mfa_enrolled: z.boolean().optional(),
});

export const updateMyInternalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    // If a new NID photo is being saved, auto-clear any pending resubmit request.
    const clearsResubmit =
      Object.prototype.hasOwnProperty.call(data, "nid_front_r2_key") ||
      Object.prototype.hasOwnProperty.call(data, "nid_back_r2_key");
    const payload: Record<string, unknown> = { ...data };
    if (clearsResubmit) {
      payload.nid_resubmit_requested_at = null;
      payload.nid_resubmit_reason = null;
    }
    const { error } = await context.supabase
      .from("internal_profiles")
      .update(payload as never)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { invalidateProfileCache } = await import("@/lib/profile-cache.server");
    await invalidateProfileCache(context.userId);
    return { ok: true };
  });

export const getInternalDocSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Super_admin can read any internal-docs key; others can only read a key
    // referenced by their own internal_profiles row (works even when the key
    // was uploaded on their behalf by an admin — the file path in R2 uses
    // the uploader's id, so a startsWith check is not sufficient).
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const isSuperAdmin = role === true;
    if (!isSuperAdmin) {
      const { data: own } = await context.supabase
        .from("internal_profiles")
        .select("cv_r2_key, nid_front_r2_key, nid_back_r2_key")
        .eq("user_id", context.userId)
        .maybeSingle();
      const keys = [own?.cv_r2_key, own?.nid_front_r2_key, own?.nid_back_r2_key].filter(Boolean);
      if (!keys.includes(data.key)) throw new Error("Forbidden");
    }
    const { createPresignedGetUrl } = await import("@/lib/r2.server");
    return createPresignedGetUrl({ key: data.key, expiresInSeconds: 300 });
  });

export const completeInternalFirstLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: primaryRole, error: roleError } = await context.supabase.rpc("get_primary_role", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!["employee", "instructor", "super_admin"].includes(String(primaryRole))) {
      throw new Error("Forbidden");
    }
    const { error } = await context.supabase
      .from("internal_profiles")
      .update({ first_login_completed: true } as never)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { invalidateProfileCache } = await import("@/lib/profile-cache.server");
    await invalidateProfileCache(context.userId);
    return { ok: true };
  });
