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

    // Fire-and-forget welcome email (logged into internal_email_deliveries).
    try {
      const { sendInternalWelcomeEmail } = await import("@/lib/internal-welcome.server");
      await sendInternalWelcomeEmail(supabaseAdmin, {
        userId: newUserId,
        fullName: data.full_name,
        email: data.email,
        phone,
        password: data.password,
        role: data.role,
      });
    } catch (err) {
      console.error("[createInternalUser] welcome email dispatch failed", err);
    }

    return { ok: true, user_id: newUserId };
  });

export const listInternalEmailDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("internal_email_deliveries")
      .select(
        "id, kind, to_email, subject, status, resend_email_id, error_reason, sent_at, delivered_at, opened_at, clicked_at, bounced_at, created_at, updated_at",
      )
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function ensureSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: super_admin only");
}

export type InternalUserDetail = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: string[];
  primary_role: "employee" | "instructor" | "super_admin" | "student" | null;
  display_id: string | null;
  is_active: boolean;
  mfa_enrolled: boolean;
  mfa_factor_count: number;
  address: string | null;
  nid_number: string | null;
  cv_r2_key: string | null;
  workplace: string | null;
  job_role: string | null;
  subjects: string[];
  departments: string[];
  bank_details: Record<string, unknown> | null;
  auth: {
    created_at: string | null;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    phone_confirmed_at: string | null;
    providers: string[];
  };
};

export const getInternalUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<InternalUserDetail> => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: prof }, { data: internal }, { data: roles }, { data: authUser }, { data: factors }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
        supabaseAdmin.from("internal_profiles").select("*").eq("user_id", data.user_id).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id),
        supabaseAdmin.auth.admin.getUserById(data.user_id),
        supabaseAdmin.auth.admin.mfa.listFactors({ userId: data.user_id } as any).catch(() => ({ data: { factors: [] } })),
      ]);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const priority: Record<string, number> = { super_admin: 1, instructor: 2, employee: 3, student: 4 };
    const primary = roleList.slice().sort((a, b) => (priority[a] ?? 9) - (priority[b] ?? 9))[0] ?? null;
    const u: any = authUser?.user ?? {};
    const p: any = prof ?? {};
    const i: any = internal ?? {};
    const factorList = (factors as any)?.data?.factors ?? (factors as any)?.factors ?? [];
    const verifiedFactors = (factorList as any[]).filter((f) => f?.status === "verified");
    const providers = ((u?.identities ?? []) as any[]).map((x) => x?.provider).filter(Boolean);
    return {
      user_id: data.user_id,
      full_name: p.full_name ?? u.user_metadata?.full_name ?? null,
      phone: p.phone ?? u.phone ?? null,
      email: p.email ?? u.email ?? null,
      avatar_url: p.avatar_url ?? null,
      roles: roleList,
      primary_role: primary as any,
      display_id: i.display_id ?? null,
      is_active: i.is_active ?? true,
      mfa_enrolled: i.mfa_enrolled ?? false,
      mfa_factor_count: verifiedFactors.length,
      address: i.address ?? null,
      nid_number: i.nid_number ?? null,
      cv_r2_key: i.cv_r2_key ?? null,
      workplace: i.workplace ?? null,
      job_role: i.job_role ?? null,
      subjects: i.subjects ?? [],
      departments: i.departments ?? [],
      bank_details: i.bank_details ?? null,
      auth: {
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        phone_confirmed_at: u.phone_confirmed_at ?? null,
        providers,
      },
    };
  });

export const getUserCvSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("internal_profiles")
      .select("cv_r2_key")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const key = (row as any)?.cv_r2_key as string | null;
    if (!key) throw new Error("No CV uploaded");
    const { createPresignedGetUrl } = await import("@/lib/r2.server");
    return createPresignedGetUrl({ key, expiresInSeconds: 300 });
  });

export const listUserSessionsAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_sessions")
      .select(
        "id, device_label, ip, browser, os, device_type, country, region, city, created_at, last_seen_at",
      )
      .eq("user_id", data.user_id)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeUserSessionAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_sessions")
      .select("session_token_hash")
      .eq("id", data.session_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (row?.session_token_hash) {
      try {
        await supabaseAdmin.auth.admin.signOut(row.session_token_hash as string).catch(() => {});
      } catch {}
    }
    await supabaseAdmin.from("user_sessions").delete().eq("id", data.session_id).eq("user_id", data.user_id);
    return { ok: true };
  });

export const revokeAllUserSessionsAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Sign out all auth sessions for the user (global scope)
    try {
      await (supabaseAdmin.auth.admin as any).signOut(data.user_id, "global").catch(() => {});
    } catch {}
    // Nuke tracked rows
    await supabaseAdmin.from("user_sessions").delete().eq("user_id", data.user_id);
    return { ok: true };
  });

export const resetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await (supabaseAdmin.auth.admin.mfa as any)
      .listFactors({ userId: data.user_id })
      .catch(() => ({ data: { factors: [] } }));
    const factors = (list as any)?.factors ?? [];
    for (const f of factors) {
      try {
        await (supabaseAdmin.auth.admin.mfa as any).deleteFactor({ userId: data.user_id, id: f.id });
      } catch (e) {
        console.error("[resetUserMfa] deleteFactor failed", e);
      }
    }
    await supabaseAdmin
      .from("internal_profiles")
      .update({ mfa_enrolled: false } as never)
      .eq("user_id", data.user_id);
    return { ok: true, cleared: factors.length };
  });

export const deleteInternalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), confirm_email: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const actualEmail = String(authUser?.user?.email ?? "").trim().toLowerCase();
    if (!actualEmail || actualEmail !== data.confirm_email.trim().toLowerCase()) {
      throw new Error("Confirmation email does not match");
    }
    // Best-effort clean-up of dependent rows (FK cascades may already handle these)
    await supabaseAdmin.from("user_sessions").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("internal_profiles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("Cannot impersonate yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = String(authUser?.user?.email ?? "").trim().toLowerCase();
    if (!email) throw new Error("Target user has no email");
    const { data: link, error } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: "magiclink",
      email,
    });
    if (error) throw new Error(error.message);
    const hashed_token = (link as any)?.properties?.hashed_token as string | undefined;
    if (!hashed_token) throw new Error("Failed to create sign-in token");
    // Also return target role for correct redirect
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const priority: Record<string, number> = { super_admin: 1, instructor: 2, employee: 3, student: 4 };
    const primary = roleList.slice().sort((a, b) => (priority[a] ?? 9) - (priority[b] ?? 9))[0] ?? "student";
    console.log("[impersonate] issued token for", data.user_id, "by admin", context.userId);
    return { email, hashed_token, primary_role: primary };
  });
