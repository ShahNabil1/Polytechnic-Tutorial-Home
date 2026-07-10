import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoleInfo, type AppRole } from "@/lib/roles.functions";
import { useAuth } from "@/hooks/use-auth";

export type RoleInfo = {
  roles: AppRole[];
  primaryRole: AppRole;
  permissions: string[];
};

const INTERNAL_ROLES: AppRole[] = ["employee", "instructor", "super_admin"];

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const fetchRole = useServerFn(getMyRoleInfo);
  const [info, setInfo] = useState<RoleInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setInfo(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRole({})
      .then((res) => {
        if (!cancelled) setInfo(res as RoleInfo);
      })
      .catch(() => {
        if (!cancelled) setInfo({ roles: ["student"], primaryRole: "student", permissions: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, fetchRole]);

  const isInternal = !!info && INTERNAL_ROLES.includes(info.primaryRole);
  const has = (perm: string) =>
    !!info && (info.primaryRole === "super_admin" || info.permissions.includes(perm));
  const isRole = (r: AppRole) => !!info && info.roles.includes(r);

  return { info, loading, isInternal, has, isRole };
}

export function primaryHome(role: AppRole): string {
  if (role === "super_admin" || role === "employee") return "/workspace";
  if (role === "instructor") return "/instructor";
  return "/sdash";
}
