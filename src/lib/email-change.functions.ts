import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Securely change the caller's primary auth email.
 *
 * - Only allowed for internal roles (employee / instructor / super_admin).
 * - Instantly updates auth.users.email (email_confirm = true) so the new
 *   email is usable right away.
 * - Deletes any Google identity that was tied to the OLD email address,
 *   so the previous Google account can no longer sign in as this user.
 * - Syncs profiles.email.
 *
 * The client MUST call ensureReauth() before invoking this — the server
 * still enforces role + uniqueness, but reauth is what protects against
 * session hijack.
 */
export const changeMyPrimaryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        newEmail: z.string().trim().toLowerCase().email().max(254),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: primaryRole, error: roleError } = await context.supabase.rpc("get_primary_role", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!["employee", "instructor", "super_admin"].includes(String(primaryRole))) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr) throw new Error(userErr.message);

    const oldEmail = String(authUser.user?.email ?? "").trim().toLowerCase();
    const newEmail = data.newEmail;

    if (!newEmail) throw new Error("Invalid email");
    if (oldEmail === newEmail) throw new Error("This is already your email");

    // Uniqueness: reject if another user already owns this email.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", newEmail)
      .limit(1)
      .maybeSingle();
    if (existingProfile && existingProfile.id !== context.userId) {
      throw new Error("This email is already in use by another account");
    }

    // 1) Update the auth user's primary email — instant, pre-confirmed.
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email: newEmail,
      email_confirm: true,
    } as never);
    if (updErr) throw new Error(updErr.message);

    // 2) Unlink any Google identity that was tied to the OLD email address.
    //    Supabase JS admin has no deleteIdentity helper, so call the REST
    //    endpoint directly with the service role key.
    const identities = (authUser.user?.identities ?? []) as Array<{
      identity_id?: string;
      id?: string;
      provider?: string;
      identity_data?: { email?: string };
    }>;

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SERVICE_ROLE_KEY ?? "";

    const unlinked: string[] = [];
    if (SERVICE_KEY) {
      for (const idn of identities) {
        const idEmail = String(idn?.identity_data?.email ?? "").trim().toLowerCase();
        const idnId = idn.identity_id ?? idn.id;
        if (!idnId) continue;
        // Only unlink OAuth-style identities that carried the old email.
        if (idn.provider && idn.provider !== "email" && idn.provider !== "phone" && idEmail === oldEmail) {
          const res = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${context.userId}/identities/${idnId}`,
            {
              method: "DELETE",
              headers: {
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
              },
            },
          );
          if (res.ok) unlinked.push(idn.provider);
        }
      }
    }

    // 3) Sync profiles.email.
    await supabaseAdmin
      .from("profiles")
      .update({ email: newEmail } as never)
      .eq("id", context.userId);

    return { ok: true, email: newEmail, unlinked };
  });
