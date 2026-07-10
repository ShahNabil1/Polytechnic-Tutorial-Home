import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "student" | "employee" | "instructor" | "super_admin";
  display_id: string | null;
  is_active: boolean;
  mfa_enrolled: boolean;
};

export const listInternalUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["employee", "instructor", "super_admin"]);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    if (userIds.length === 0) return [] as AdminUserRow[];
    const syncedEmails = new Map<string, string>();
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
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
          if (!email || !z.string().email().safeParse(email).success) return;
          if (!currentEmail) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              email,
              email_confirm: true,
            } as never);
          }
          await supabaseAdmin.from("profiles").update({ email } as never).eq("id", userId);
          syncedEmails.set(userId, email);
        } catch {
          // Do not block the admin list if a single account cannot be synced.
        }
      }),
    );
    const [{ data: profs }, { data: internals }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, email, avatar_url").in("id", userIds),
      supabaseAdmin.from("internal_profiles").select("user_id, display_id, is_active, mfa_enrolled").in("user_id", userIds),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const imap = new Map((internals ?? []).map((i: any) => [i.user_id, i]));
    // Pick primary role per user (super_admin > instructor > employee)
    const priority: Record<string, number> = { super_admin: 1, instructor: 2, employee: 3 };
    const byUser = new Map<string, string>();
    for (const r of rows ?? []) {
      const cur = byUser.get(r.user_id);
      if (!cur || priority[r.role] < priority[cur]) byUser.set(r.user_id, r.role);
    }
    return userIds.map<AdminUserRow>((id) => {
      const p = pmap.get(id) ?? {};
      const i = imap.get(id) ?? {};
      return {
        user_id: id,
        full_name: p.full_name ?? null,
        phone: p.phone ?? null,
        email: p.email ?? syncedEmails.get(id) ?? null,
        avatar_url: p.avatar_url ?? null,
        role: byUser.get(id) as AdminUserRow["role"],
        display_id: i.display_id ?? null,
        is_active: i.is_active ?? true,
        mfa_enrolled: i.mfa_enrolled ?? false,
      };
    });
  });

export const findUserByPhoneOrEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(3).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email, avatar_url")
      .or(`phone.eq.${q},email.eq.${q}`)
      .limit(5);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignInternalRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["employee", "instructor"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
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
    if (email && z.string().email().safeParse(email).success) {
      if (!currentEmail) {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email,
          email_confirm: true,
        } as never);
      }
      await supabaseAdmin.from("profiles").update({ email } as never).eq("id", data.user_id);
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role, assigned_by: context.userId } as never);
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const revokeInternalRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["employee", "instructor"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setInternalUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_profiles")
      .update({ is_active: data.is_active } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9]{10,15}$/u, "Invalid phone number"),
        password: z.string().min(8).max(128),
        role: z.enum(["employee", "instructor"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.startsWith("+") ? data.phone.slice(1) : data.phone;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      phone,
      password: data.password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message || "Failed to create user");
    }
    const newUserId = created.user.id;

    // Ensure profile row reflects provided details (trigger inserts a base row).
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, email: data.email, phone } as never)
      .eq("id", newUserId);

    // Remove default 'student' role assigned by trigger for internal accounts.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId).eq("role", "student");

    const { error: assignErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role, assigned_by: context.userId } as never);
    if (assignErr && !assignErr.message.includes("duplicate")) {
      throw new Error(assignErr.message);
    }

    return { ok: true, user_id: newUserId };
  });
