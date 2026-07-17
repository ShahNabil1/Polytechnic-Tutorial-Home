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

function stripBDCountryCode(phone: string | null): string | null {
  if (!phone) return phone;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length > 11) return digits.slice(2);
  return digits || null;
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureCanManageUsers(context: { supabase: any; userId: string }) {
  const [{ data: canManage, error: permissionError }, { data: isSuperAdmin, error: roleError }] = await Promise.all([
    context.supabase.rpc("has_permission", {
      _user_id: context.userId,
      _permission: "manage_users",
    }),
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    }),
  ]);
  if (permissionError) throw new Error(permissionError.message);
  if (roleError) throw new Error(roleError.message);
  if (canManage !== true) throw new Error("Forbidden: manage_users only");
  return { isSuperAdmin: isSuperAdmin === true };
}

async function ensureManageableTarget(
  context: { supabase: any; userId: string },
  targetUserId: string,
) {
  const caller = await ensureCanManageUsers(context);
  if (targetUserId === context.userId) {
    throw new Error("You cannot perform this action on your own account");
  }
  const { data: targetIsSuperAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: targetUserId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (targetIsSuperAdmin === true && !caller.isSuperAdmin) {
    throw new Error("Forbidden: only super_admin can manage a super_admin account");
  }
  return caller;
}

async function revokeAllTargetSessions(context: { supabase: any }, targetUserId: string) {
  const { error } = await context.supabase.rpc("admin_revoke_all_user_sessions" as any, {
    _target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
}

export const listInternalUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManageUsers(context);
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
        phone: stripBDCountryCode(p.phone ?? null),
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
    await ensureCanManageUsers(context);
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
    await ensureCanManageUsers(context);
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
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await revokeAllTargetSessions(context, data.user_id);
    return { ok: true };
  });

export const setInternalUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_profiles")
      .update({ is_active: data.is_active } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.is_active ? "none" : "876000h",
    } as never);
    if (authError) throw new Error(authError.message);
    if (!data.is_active) await revokeAllTargetSessions(context, data.user_id);
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
          .transform((v) => {
            let s = v.replace(/\D/g, "");
            if (s.startsWith("88") && s.length > 11) s = s.slice(2);
            return s;
          })
          .pipe(z.string().regex(/^01[3-9][0-9]{8}$/u, "Enter a valid BD phone (01XXXXXXXXX)")),
        password: z.string().min(8).max(128),
        role: z.enum(["employee", "instructor"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Raw BD phone (e.g. 01XXXXXXXXX) — stored in profiles as-is; auth needs the 88 prefix (E.164 without '+').
    const rawPhone = data.phone;
    const authPhone = `88${rawPhone}`;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      phone: authPhone,
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
      .update({ full_name: data.full_name, email: data.email, phone: rawPhone } as never)
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
        phone: rawPhone,
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
    await ensureCanManageUsers(context);
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

export const listInternalSmsDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("crm_sms_deliveries")
      .select(
        "id, kind, to_phone, body, status, sms_count, is_unicode, provider_status, error_reason, created_at, updated_at",
      )
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


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
  nid_front_r2_key: string | null;
  nid_back_r2_key: string | null;
  nid_resubmit_requested_at: string | null;
  nid_resubmit_reason: string | null;
  workplace: string | null;
  job_role: string | null;
  subjects: string[];
  departments: string[];
  bank_details: any | null;
  student_profile: {
    institute_name: string | null;
    department_name: string | null;
    current_semester: string | null;
    board_roll: string | null;
    registration_no: string | null;
    student_id: number | null;
  };
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
    await ensureCanManageUsers(context);
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
      phone: stripBDCountryCode(p.phone ?? u.phone ?? null),
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
      nid_front_r2_key: i.nid_front_r2_key ?? null,
      nid_back_r2_key: i.nid_back_r2_key ?? null,
      nid_resubmit_requested_at: i.nid_resubmit_requested_at ?? null,
      nid_resubmit_reason: i.nid_resubmit_reason ?? null,
      workplace: i.workplace ?? null,
      job_role: i.job_role ?? null,
      subjects: i.subjects ?? [],
      departments: i.departments ?? [],
      bank_details: i.bank_details ?? null,
      student_profile: {
        institute_name: p.institute_name ?? null,
        department_name: p.department_name ?? null,
        current_semester: p.current_semester ?? null,
        board_roll: p.board_roll ?? null,
        registration_no: p.registration_no ?? null,
        student_id: p.student_id ?? null,
      },
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
    await ensureCanManageUsers(context);
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

export const getUserNidSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), side: z.enum(["front", "back"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const col = data.side === "front" ? "nid_front_r2_key" : "nid_back_r2_key";
    const { data: row } = await supabaseAdmin
      .from("internal_profiles")
      .select(col)
      .eq("user_id", data.user_id)
      .maybeSingle();
    const key = (row as any)?.[col] as string | null;
    if (!key) throw new Error(`No NID ${data.side} photo uploaded`);
    const { createPresignedGetUrl } = await import("@/lib/r2.server");
    return createPresignedGetUrl({ key, expiresInSeconds: 300 });
  });

export const requestNidResubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ user_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_profiles")
      .update({
        nid_resubmit_requested_at: new Date().toISOString(),
        nid_resubmit_reason: data.reason,
        nid_resubmit_requested_by: context.userId,
      } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelNidResubmit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("internal_profiles")
      .update({
        nid_resubmit_requested_at: null,
        nid_resubmit_reason: null,
        nid_resubmit_requested_by: null,
      } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listUserSessionsAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
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
    await ensureManageableTarget(context, data.user_id);
    const { data: ok, error } = await context.supabase.rpc("admin_revoke_user_session" as any, {
      _target_user_id: data.user_id,
      _tracked_id: data.session_id,
    } as never);
    if (error) throw new Error(error.message);
    if (ok !== true) throw new Error("Session not found or already signed out");
    return { ok: true };
  });

export const revokeAllUserSessionsAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { data: revoked, error } = await context.supabase.rpc("admin_revoke_all_user_sessions" as any, {
      _target_user_id: data.user_id,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, revoked: revoked ?? 0 };
  });

export const resetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
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
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const actualEmail = String(authUser?.user?.email ?? "").trim().toLowerCase();
    if (!actualEmail || actualEmail !== data.confirm_email.trim().toLowerCase()) {
      throw new Error("Confirmation email does not match");
    }
    await revokeAllTargetSessions(context, data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await Promise.allSettled([
      supabaseAdmin.from("user_sessions").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("user_permissions").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("internal_profiles").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("profiles").delete().eq("id", data.user_id),
    ]);
    return { ok: true };
  });

export const verifyImpersonationBypass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ target_user_id: z.string().uuid(), token: z.string().min(20).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (context.userId !== data.target_user_id) return { ok: false };
    const tokenHash = await sha256Hex(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("impersonation_sessions")
      .select("id, expires_at")
      .eq("target_user_id", data.target_user_id)
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !row) return { ok: false };
    await (supabaseAdmin as any)
      .from("impersonation_sessions")
      .update({ used_at: new Date().toISOString() } as never)
      .eq("id", (row as any).id);
    return { ok: true };
  });

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    let email = String(authUser?.user?.email ?? "").trim().toLowerCase();
    const phone = String(authUser?.user?.phone ?? "").trim();
    if (!email && !phone) throw new Error("Target user has neither email nor phone — cannot sign in as them");
    const { data: internal } = await supabaseAdmin
      .from("internal_profiles")
      .select("is_active")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if ((internal as any)?.is_active === false) throw new Error("Target account is deactivated");

    // Phone-only auth users have no email → magiclink can't be issued. Attach a synthetic,
    // routable-looking placeholder email so generateLink works, then leave it in place
    // (harmless — user still signs in via phone OTP). Revert on failure.
    let attachedEmail = false;
    if (!email) {
      const synth = `phone-${data.user_id}@users.polytechnictutorial.local`;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        email: synth,
        email_confirm: true,
      } as any);
      if (updErr) throw new Error(`Cannot prepare sign-in for phone-only user: ${updErr.message}`);
      email = synth;
      attachedEmail = true;
    }

    const { data: link, error } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: "magiclink",
      email,
    });
    if (error) {
      if (attachedEmail) {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: null } as any).catch(() => {});
      }
      throw new Error(error.message);
    }
    const hashed_token = (link as any)?.properties?.hashed_token as string | undefined;
    if (!hashed_token) {
      if (attachedEmail) {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, { email: null } as any).catch(() => {});
      }
      throw new Error("Failed to create sign-in token");
    }
    // Also return target role for correct redirect
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const priority: Record<string, number> = { super_admin: 1, instructor: 2, employee: 3, student: 4 };
    const primary = roleList.slice().sort((a, b) => (priority[a] ?? 9) - (priority[b] ?? 9))[0] ?? "student";
    const bypassToken = `${globalThis.crypto.randomUUID()}.${globalThis.crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: insertError } = await (supabaseAdmin as any).from("impersonation_sessions").insert({
      admin_user_id: context.userId,
      target_user_id: data.user_id,
      token_hash: await sha256Hex(bypassToken),
      expires_at: expiresAt,
    } as never);
    if (insertError) throw new Error(insertError.message);
    console.log("[impersonate] issued token for", data.user_id, "by admin", context.userId);
    return { email, hashed_token, primary_role: primary, bypass_token: bypassToken, bypass_expires_at: expiresAt };
  });

// =====================================================================
// Admin: Passkey management for a target user
// =====================================================================

export const adminListUserPasskeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminDeleteUserPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("webauthn_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// Admin: Reset password — generate a strong random password, apply it,
// email it to the user's primary email, and log the delivery so it shows
// up in the same Email Logs panel.
// =====================================================================

function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const pw = [rand(upper), rand(lower), rand(digits), rand(symbols)];
  for (let i = 0; i < 10; i++) pw.push(rand(all));
  // Fisher–Yates
  for (let i = pw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join("");
}

export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        channel: z.enum(["email", "sms"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = String(authUser?.user?.email ?? "").trim().toLowerCase();
    const phone = String(authUser?.user?.phone ?? "").trim();

    const channel: "email" | "sms" =
      data.channel ?? (email ? "email" : phone ? "sms" : "email");

    if (channel === "email" && !email) throw new Error("Target has no primary email on file");
    if (channel === "sms" && !phone) throw new Error("Target has no phone number on file");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user_id)
      .maybeSingle();
    const fullName = (prof as any)?.full_name || (authUser?.user as any)?.user_metadata?.full_name || "Team member";

    const newPassword = generateStrongPassword();

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: newPassword,
    } as never);
    if (updErr) throw new Error(updErr.message);

    // Kill all existing sessions so old devices must sign in with the new password.
    await revokeAllTargetSessions(context, data.user_id);

    const { SITE_URL } = await import("@/lib/site-url");

    if (channel === "sms") {
      const { sendBulksmsbd, estimateSmsCount, isUnicodeMessage } = await import(
        "@/lib/sms.server"
      );
      const message = `নমস্কার ${fullName}, আপনার পাসওয়ার্ড রিসেট করা হয়েছে। নতুন পাসওয়ার্ড: ${newPassword} । লগইন: ${SITE_URL}/auth`;
      const isUnicode = isUnicodeMessage(message);
      const smsCount = estimateSmsCount(message);
      const res = await sendBulksmsbd({ to: phone, message });
      try {
        await supabaseAdmin.from("crm_sms_deliveries").insert({
          user_id: data.user_id,
          to_phone: phone,
          body: message,
          kind: "internal_password_reset",
          sender_user_id: context.userId,
          status: res.ok ? "sent" : "failed",
          sms_count: smsCount,
          is_unicode: isUnicode,
          provider_status: res.response_code,
          provider_response: res.response?.slice(0, 500) ?? null,
          error_reason: res.ok ? null : res.code_label ?? res.response?.slice(0, 500) ?? null,
        } as never);
      } catch (logErr) {
        console.error("[adminResetUserPassword] sms log failed", logErr);
      }
      if (!res.ok) {
        return { ok: true, channel, sent: false, error: res.code_label ?? "sms failed" };
      }
      return { ok: true, channel, sent: true };
    }

    // Send email using the same helper/log path as internal_welcome.
    try {
      const { renderEmailTemplate } = await import("@/lib/email-templates.server");
      const { sendEbookEmail } = await import("@/lib/ebook-delivery.server");

      const { data: tpl } = await supabaseAdmin
        .from("email_templates")
        .select("subject, body_html, enabled")
        .eq("key", "internal_password_reset")
        .maybeSingle();

      const vars = {
        full_name: fullName,
        email,
        password: newPassword,
        login_url: `${SITE_URL}/auth`,
      };

      const subject = tpl?.subject
        ? renderEmailTemplate(tpl.subject as string, vars)
        : `আপনার পাসওয়ার্ড রিসেট করা হয়েছে`;
      const body = tpl?.body_html
        ? renderEmailTemplate(tpl.body_html as string, vars)
        : `<p>নমস্কার ${fullName},</p><p>আপনার একাউন্টের পাসওয়ার্ড এ্যাডমিন কর্তৃক রিসেট করা হয়েছে।</p>
           <p><b>নতুন পাসওয়ার্ড:</b> <code style="font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${newPassword}</code></p>
           <p>লগইন: <a href="${SITE_URL}/auth">${SITE_URL}/auth</a></p>
           <p>নিরাপত্তার জন্য লগইন করে সাথে সাথে পাসওয়ার্ড পরিবর্তন করুন।</p>`;
      const html = `<!doctype html><html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">${body}</body></html>`;

      const { data: row } = await supabaseAdmin
        .from("internal_email_deliveries")
        .insert({
          user_id: data.user_id,
          kind: "internal_password_reset",
          to_email: email,
          subject,
          status: "queued",
        } as never)
        .select("id")
        .single();

      const res = await sendEbookEmail({ to: email, subject, html });

      if ((row as any)?.id) {
        await supabaseAdmin
          .from("internal_email_deliveries")
          .update({
            status: res.ok ? "sent" : "failed",
            resend_email_id: res.ok ? (res as any).id : null,
            sent_at: res.ok ? new Date().toISOString() : null,
            error_reason: res.ok ? null : ((res as any).error?.slice?.(0, 500) ?? null),
          } as never)
          .eq("id", (row as any).id);
      }

      if (!res.ok) {
        return { ok: true, channel, sent: false, emailed: false, error: (res as any).error ?? "email failed" };
      }
    } catch (err) {
      console.error("[adminResetUserPassword] email dispatch failed", err);
      return { ok: true, channel, sent: false, emailed: false, error: err instanceof Error ? err.message : String(err) };
    }

    return { ok: true, channel, sent: true, emailed: true };
  });


// ============================================================================
// Admin editable profile — mirrors what a user can edit on their own profile.
// ============================================================================

const AdminInternalProfileUpdateSchema = z.object({
  user_id: z.string().uuid(),
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

export const adminGetTargetInternalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManageUsers(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("internal_profiles")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as any;
  });

export const adminUpdateTargetBasicProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().max(200).nullable().optional(),
        avatar_url: z.string().max(1000).nullable().optional(),
        institute_name: z.string().max(200).nullable().optional(),
        department_name: z.string().max(200).nullable().optional(),
        current_semester: z.string().max(40).nullable().optional(),
        board_roll: z.string().max(60).nullable().optional(),
        registration_no: z.string().max(60).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = {};
    const keys = [
      "full_name",
      "avatar_url",
      "institute_name",
      "department_name",
      "current_semester",
      "board_roll",
      "registration_no",
    ] as const;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        const v = (data as any)[k];
        payload[k] = typeof v === "string" ? v.trim() || null : v ?? null;
      }
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(payload as never)
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateTargetInternalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminInternalProfileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user_id, ...rest } = data;
    const { error } = await supabaseAdmin
      .from("internal_profiles")
      .update(rest as never)
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Admin: Change target's primary email and/or phone.
// - Updates auth.users (email/phone) with confirm flags so they're usable now.
// - Unlinks any OAuth identity (e.g. Google) tied to the OLD email so the
//   previous Google account can no longer sign in as this user.
// - Syncs profiles.email / profiles.phone (phone stored raw as 01XXXXXXXXX).
// - Revokes all existing sessions so the user must sign in again.
// ============================================================================

export const adminChangeTargetContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email()
          .max(254)
          .optional()
          .nullable(),
        phone: z
          .string()
          .trim()
          .transform((v) => {
            let s = v.replace(/\D/g, "");
            if (s.startsWith("88") && s.length > 11) s = s.slice(2);
            return s;
          })
          .pipe(z.string().regex(/^01[3-9][0-9]{8}$/u, "Enter a valid BD phone (01XXXXXXXXX)"))
          .optional()
          .nullable(),
      })
      .refine((v) => !!v.email || !!v.phone, {
        message: "Provide email or phone to change",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureManageableTarget(context, data.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      data.user_id,
    );
    if (userErr) throw new Error(userErr.message);

    const oldEmail = String(authUser.user?.email ?? "").trim().toLowerCase();
    const oldPhone = String(authUser.user?.phone ?? "").trim();
    const newEmail = data.email || null;
    const newPhoneRaw = data.phone || null;
    const newAuthPhone = newPhoneRaw ? `88${newPhoneRaw}` : null;

    // Uniqueness checks against profiles
    if (newEmail) {
      if (newEmail === oldEmail) {
        // no-op for email
      } else {
        const { data: dupe } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", newEmail)
          .limit(1)
          .maybeSingle();
        if (dupe && (dupe as any).id !== data.user_id) {
          throw new Error("This email is already in use by another account");
        }
      }
    }
    if (newPhoneRaw) {
      const { data: dupe } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", newPhoneRaw)
        .limit(1)
        .maybeSingle();
      if (dupe && (dupe as any).id !== data.user_id) {
        throw new Error("This phone is already in use by another account");
      }
    }

    // Build auth update payload
    const authPayload: Record<string, unknown> = {};
    if (newEmail && newEmail !== oldEmail) {
      authPayload.email = newEmail;
      authPayload.email_confirm = true;
    }
    if (newAuthPhone && newAuthPhone !== oldPhone) {
      authPayload.phone = newAuthPhone;
      authPayload.phone_confirm = true;
    }
    if (Object.keys(authPayload).length > 0) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        data.user_id,
        authPayload as never,
      );
      if (updErr) throw new Error(updErr.message);
    }

    // Unlink any OAuth identity (Google etc.) tied to the OLD email address.
    const unlinked: string[] = [];
    if (newEmail && newEmail !== oldEmail && oldEmail) {
      const identities = (authUser.user?.identities ?? []) as Array<{
        identity_id?: string;
        id?: string;
        provider?: string;
        identity_data?: { email?: string };
      }>;
      const SUPABASE_URL = process.env.SUPABASE_URL!;
      const SERVICE_KEY =
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SB_SERVICE_ROLE_KEY ?? "";
      if (SERVICE_KEY) {
        for (const idn of identities) {
          const idEmail = String(idn?.identity_data?.email ?? "").trim().toLowerCase();
          const idnId = idn.identity_id ?? idn.id;
          if (!idnId) continue;
          if (
            idn.provider &&
            idn.provider !== "email" &&
            idn.provider !== "phone" &&
            idEmail === oldEmail
          ) {
            const res = await fetch(
              `${SUPABASE_URL}/auth/v1/admin/users/${data.user_id}/identities/${idnId}`,
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
    }

    // Sync profiles row
    const profilePayload: Record<string, unknown> = {};
    if (newEmail) profilePayload.email = newEmail;
    if (newPhoneRaw) profilePayload.phone = newPhoneRaw;
    if (Object.keys(profilePayload).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(profilePayload as never)
        .eq("id", data.user_id);
    }

    // Kill all sessions so the change takes effect immediately.
    if (Object.keys(authPayload).length > 0) {
      await revokeAllTargetSessions(context, data.user_id);
    }

    return { ok: true, email: newEmail, phone: newPhoneRaw, unlinked };
  });
