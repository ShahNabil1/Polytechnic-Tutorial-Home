import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "student" | "employee" | "instructor" | "super_admin";

export const getMyRoleInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: roleRows }, { data: permRows }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_permissions").select("permission").eq("user_id", userId),
    ]);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    const priority: AppRole[] = ["super_admin", "instructor", "employee", "student"];
    const primary = priority.find((p) => roles.includes(p)) ?? "student";
    return {
      roles,
      primaryRole: primary,
      permissions: (permRows ?? []).map((p) => p.permission as string),
    };
  });
