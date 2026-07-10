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
    const { data, error } = await context.supabase
      .from("internal_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as InternalProfile | null) ?? null;
  });

const UpdateSchema = z.object({
  address: z.string().max(500).optional().nullable(),
  nid_number: z.string().max(50).optional().nullable(),
  cv_r2_key: z.string().max(300).optional().nullable(),
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
});

export const updateMyInternalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("internal_profiles")
      .update(data as never)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInternalDocSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Owner can read their own key; super_admin can read any (starting with internal-docs/)
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const isSuperAdmin = role === true;
    if (!isSuperAdmin && !data.key.startsWith(`internal-docs/${context.userId}/`)) {
      throw new Error("Forbidden");
    }
    const { createPresignedGetUrl } = await import("@/lib/r2.server");
    return createPresignedGetUrl({ key: data.key, expiresInSeconds: 300 });
  });
