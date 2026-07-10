# Enterprise RBAC + Profile System — Implementation Plan

Goal: add 4 roles (Student default, Employee, Instructor, Super Admin), route them to separate dashboards, add TOTP 2FA + 30-min inactivity for internal roles, and reuse the existing student profile with dynamic role-specific fields — without breaking any current student flow.

---

## 1. Database schema (one migration)

`**app_role` enum**: `student | employee | instructor | super_admin`.

`**public.user_roles**` — canonical role table (per system rules; never on `profiles`).

- `id`, `user_id → auth.users`, `role app_role`, `assigned_by`, `assigned_at`
- Unique `(user_id, role)`
- Partial unique index `WHERE role='super_admin'` → guarantees exactly one Super Admin
- RLS: users can read their own rows; only Super Admin can insert/update/delete (via `has_role`)

**Security definer functions**:

- `has_role(_user_id uuid, _role app_role) → boolean`
- `get_primary_role(_user_id uuid) → app_role` (returns highest-privilege role for routing)

`**public.internal_profiles**` — one row per non-student user (kept separate so student `profiles` schema is untouched):

- `user_id PK → auth.users`
- `display_id text unique` (Super Admin=`001`, Employee=random 4-digit, Instructor=random 5-digit)
- `address text`, `nid_number text` (encrypted at rest via pgsodium or app-layer)
- `cv_r2_key text`, `bank_details jsonb` (account name/number, bank, branch, routing, or MFS provider+number)
- Instructor-only: `workplace text`, `job_role text`, `subjects text[]`, `departments text[]`
- `mfa_enrolled boolean default false`, `first_login_completed boolean default false`
- RLS: user reads/updates own row; Super Admin reads/updates all; Employees read own only

**Display ID generation**: DB trigger on `user_roles` insert → creates the `internal_profiles` row with a generated ID (retry on collision) and seeds `001` for Super Admin.

**Seed the first Super Admin** in the same migration: user provides phone/email; migration inserts `user_roles(super_admin)` for that `auth.users.id` and creates `internal_profiles` with `display_id='001'`.

**R2 layout** (reuse existing R2 setup): `private/nid/{user_id}.pdf`, `private/cv/{user_id}.pdf`. Upload + download go through new signed-URL server functions gated by `has_role`. No public URLs.

---

## 2. Routing & auth-gate composition

- Keep `src/routes/_authenticated/` as-is (integration-managed gate).
- Add pathless nested layouts under it that also enforce role and 2FA:
  - `src/routes/_authenticated/_internal/route.tsx` — requires role ∈ {employee, super_admin, instructor}. Runs SessionEnforcer + **InactivityEnforcer (30 min)** + **MFA-required guard**.
  - `/workspace` → `_authenticated/_internal/workspace.*` (Employee + Super Admin)
  - `/instructor` → `_authenticated/_internal/instructor.*` (Instructor)
- **Post-login role router**: on sign-in success, `use-auth` fetches `get_primary_role`, then redirects: student → `/sdash`, employee/super_admin → `/workspace`, instructor → `/instructor`. Also runs on `/` for logged-in users so bookmarks resolve correctly.
- **First-login gate**: if `internal_profiles.first_login_completed=false`, force `/workspace/setup` (password + TOTP enrollment). All other internal routes redirect back until complete.
- **MFA-always-on**: if internal role but `mfa_enrolled=false` and `first_login_completed=true` (Super Admin reset), force logout with a clear message + redirect to setup on next login.

---

## 3. Auth flows

**Student signup** (existing auth-drawer) — unchanged. Newly created users get `user_roles(role='student')` via updated `handle_new_user` trigger.

**Public signup blocked for internal roles**: no UI change needed (creation happens inside), but `handle_new_user` always assigns `student` — internal roles only exist via admin action.

**Internal user creation** (from `/workspace/employees` or `/workspace/instructors`, Super Admin only):

- Server fn `createInternalUser` (uses `supabaseAdmin` inside handler, after `has_role(super_admin)` check):
  - `admin.createUser({ phone, email, password: temp-random })` — user gets a temporary password shown once to Super Admin to hand over
  - Inserts `user_roles` row + `internal_profiles` (auto-generated display ID)
  - Sets `first_login_completed=false`

**Login (all roles)** — reuse existing auth-drawer:

- Phone+password OR email+password identical to today.
- After password auth, `use-auth` calls `supabase.auth.mfa.listFactors()`:
  - Student → done, redirect.
  - Internal + no verified TOTP factor → if `first_login_completed=false` route to `/workspace/setup`; else force sign-out (2FA missing = block).
  - Internal + verified TOTP → drawer switches OTP UI (existing 6-digit SMS input reused verbatim) to accept TOTP; calls `mfa.challenge()` + `mfa.verify()` to reach `aal2`; then role-route.

**First-login setup screen** (`/workspace/setup`):

1. Force change password (existing PasswordCard reused).
2. Enroll TOTP: `mfa.enroll({ factorType: 'totp' })` → show QR + secret (Google Authenticator).
3. Verify one 6-digit code via existing OTP UI → mark `mfa_enrolled=true`, `first_login_completed=true`.
4. No backup codes shown (per spec).

**2FA reset** (Super Admin, from employee/instructor detail page):

- Server fn lists user's factors via `supabaseAdmin.auth.admin.mfa.listFactors` and unenrolls all TOTP factors.
- Sets `mfa_enrolled=false`; next login forces re-setup.

**Inactivity enforcer (internal roles only)**:

- New component `InactivityEnforcer` mounted in `_internal/route.tsx`.
- Tracks `mousemove/keydown/click/scroll/touchstart` while `document.visibilityState==='visible'`; timer keeps running when tab hidden (per user's choice).
- Idle timeout 30 min → `supabase.auth.signOut()` + cache teardown (per Sign-Out Hygiene) + navigate to `/auth?reason=idle`.
- Student routes unaffected.

---

## 4. Profile page — one component, dynamic fields

`src/routes/_authenticated/sdash.profile.tsx` currently owns the shared profile. Refactor:

- Extract page body into `src/components/account/ProfilePage.tsx` (avatar+crop, name, phone, linked Google, passkeys, sessions, password, edit/lock behavior — all already built).
- Mount it at:
  - `/sdash/profile` (student, unchanged UX)
  - `/workspace/profile` (employee + super_admin)
  - `/instructor/profile` (instructor)
- New `<RoleProfileFields role={...} />` sub-section rendered conditionally under the shared cards:
  - **Super Admin**: read-only `Admin ID: 001`. No NID/CV/bank.
  - **Employee**: read-only `Employee ID: NNNN`, editable Address, NID (text + PDF upload), CV (PDF upload), Bank/MFS details (structured form), 2FA status card (enrolled/date/reset-own → sign-out to re-enroll).
  - **Instructor**: read-only `Instructor ID: NNNNN`, everything Employee has + Workplace, Job Role, Subjects (multi), Departments (multi from the diploma list already added).
- Edit/lock pattern (already implemented) applies to the role-specific fields too: save locks, top-right pencil unlocks.
- File uploads use new `uploadPrivateDoc` server fn → R2 private key; download via `getPrivateDocSignedUrl` (Super Admin sees any, user sees own).

---

## 5. Workspace & Instructor dashboards (skeletons only in this phase)

- `/workspace` (Employee + Super Admin shell): sidebar with Home, Profile, and — Super Admin only — Employees, Instructors, Super Admin (self only).
- `/workspace/employees` and `/workspace/instructors` (Super Admin only, gated via `has_role`): list + "Create" dialog + row actions (view, reset 2FA, deactivate).
- `/instructor` (Instructor shell): sidebar with Home, Profile. Content placeholders — spec doesn't define instructor features yet.
- All internal routes get `head({ robots: noindex })`.

---

## 6. Validation, security, i18n

- All new inputs: English-only filter (existing `toEnglishText`/`toEnglishPassword` helpers) applied to name/address/bank/workplace/etc. Bangla labels stay.
- Zod validators on every server fn (phone regex, NID length, bank account format, PDF mime + ≤10 MB).
- RLS policies for `user_roles`, `internal_profiles` written in the same migration with explicit GRANTs to `authenticated` + `service_role` (no `anon`).
- No service-role key in client bundle. `supabaseAdmin` used only inside `.handler()` with `await import(...)`.
- Update `security-memory` after migration.

---

## 7. File-level change map

**New**

- `supabase/migrations/*_rbac_internal_profiles.sql` (schema + seed Super Admin + trigger)
- `src/lib/roles.ts` (types, `useMyRole` hook via server fn)
- `src/lib/roles.functions.ts` (`getMyRole`, `getPrimaryRole`)
- `src/lib/internal-users.functions.ts` (`createInternalUser`, `listInternalUsers`, `resetUserMfa`, `deactivateUser`)
- `src/lib/internal-profile.functions.ts` (`getInternalProfile`, `updateInternalProfile`, `uploadPrivateDoc`, `getPrivateDocSignedUrl`)
- `src/lib/mfa.ts` (client helpers around `supabase.auth.mfa.*`)
- `src/components/account/InactivityEnforcer.tsx`
- `src/components/account/RoleProfileFields.tsx`
- `src/components/account/ProfilePage.tsx` (extracted shared body)
- `src/components/account/MfaSetupCard.tsx`
- `src/routes/_authenticated/_internal/route.tsx` (role + MFA + inactivity gate)
- `src/routes/_authenticated/_internal/workspace.tsx` + `workspace.index.tsx` + `workspace.profile.tsx` + `workspace.setup.tsx` + `workspace.employees.tsx` + `workspace.instructors.tsx`
- `src/routes/_authenticated/_internal/instructor.tsx` + `instructor.index.tsx` + `instructor.profile.tsx`

**Edited**

- `src/hooks/use-auth.ts` — post-login role resolution + MFA gate + redirect
- `src/components/auth-drawer.tsx` — OTP step accepts TOTP via `mfa.challenge/verify` when factor present
- `src/routes/_authenticated/sdash.profile.tsx` — swap body for `<ProfilePage role="student" />`
- `src/routes/index.tsx` — logged-in redirect by role

**Unchanged**

- Student `profiles` table, existing sdash routes, existing auth-drawer UI shape, existing SessionsCard/PasswordCard/PasskeysCard/ImageCropperDialog.

---

## 8. Rollout order (safe, non-breaking)

1. Migration: enum, `user_roles`, `internal_profiles`, `has_role`, triggers, seed Super Admin (needs your phone/email). Backfill: every existing user gets `student` role.
2. Role-aware routing on `/` — student flow verified unchanged.
3. Extract `ProfilePage`, wire student route to it (no visual change).
4. Build `_internal` layout + `/workspace` + `/instructor` skeletons.
5. First-login + TOTP setup + auth-drawer TOTP verify.
6. Inactivity enforcer.
7. Super Admin employee/instructor management + 2FA reset.
8. Role-specific profile fields + R2 private uploads.
9. Security scan + linter pass, update security memory.

---

## Open input needed before step 1

Please share the **phone or email of the first Super Admin** (existing signed-up user preferred so we don't have to create the auth user in a migration). If it must be a new user, share phone + email + a temp password to seed.  
  
The plan looks excellent! Just one minor business requirement to add before you proceed:

Please make sure we have a way to store and manage specific access permissions (like 'can_edit_product' or 'can_delete_order') for Employees. We will need this later to build a granular role-based access control so we can hide or show specific buttons based on what an employee is allowed to do.

Also, to answer your open input for Step 1, here is my existing signed-up account's information to seed the first Super Admin: **[hamidurrahmansharon2007@gmail.com, 8801338125069](mailto:hamidurrahmansharon2007@gmail.com)** 

You have my full approval to proceed with Step 1 and the rest of the rollout order!