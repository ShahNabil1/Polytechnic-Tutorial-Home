
-- Allow employees delegated the 'manage_users' permission to perform
-- admin CRUD on user/role/profile tables without being blocked by RLS.
-- Super admin already bypasses via existing has_role policies; these
-- add a parallel path for permissioned employees.

-- profiles: view and update any profile
CREATE POLICY "Permitted staff view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

-- user_roles: full CRUD (needed to create/manage employees, instructors)
CREATE POLICY "Permitted staff view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

-- internal_profiles: view/update/insert
CREATE POLICY "Permitted staff view internal profiles" ON public.internal_profiles
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff insert internal profiles" ON public.internal_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Permitted staff update internal profiles" ON public.internal_profiles
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'))
  WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

-- user_permissions: view all for permitted staff (but ONLY super_admin can
-- grant/revoke, to prevent privilege escalation).
CREATE POLICY "Permitted staff view all permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'manage_users'));
