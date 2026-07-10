
## Overview

`/sdash/profile` কে একটা পূর্ণ Account Security পেইজে পরিণত করব — চার টা সেকশনে ভাগ করে:

1. **Passkeys** (max 3, add/remove independent)
2. **Linked accounts** (Email → Google OAuth, Phone → OTP)
3. **Password** (change / set)
4. **Active sessions** (max 2 devices, real session list with IP + device)

---

## 1. Passkeys (max 3)

- `/sdash/profile` এ existing `listMyPasskeys` দিয়ে list দেখাব।
- "Add passkey" button — প্রতিটা device-এর জন্য আলাদা নাম নেওয়া যাবে (Apple Passwords/Google Passwords style)।
- Server-side limit: `beginRegistration` এর শুরুতে count check → 3 হলে error।
- প্রতিটা row-এ "Remove" button → confirm dialog → `deleteMyPasskey`।

## 2. Linked Accounts

### Email (Google OAuth link)
- Profile-এ ইমেইল field-এর পাশে "Link Google account" button।
- Click করলে `supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: <sdash/profile> } })` — Supabase-এ manual linking enabled আছে বলে সরাসরি কাজ করবে।
- সফল হলে `user.identities` refresh করে "Google · you@gmail.com · Unlink" দেখাব।

### Phone (OTP link — Google users)
- Google দিয়ে সাইন-আপ করা ইউজারের জন্য ফোন link section।
- Input: BD phone number → server fn `startPhoneLink` → Supabase `auth.admin.generateLink` টাইপের নয়, বরং `supabase.auth.updateUser({ phone })` ট্রিগার করবে built-in phone OTP → Supabase আমাদের `send-sms-hook` কে কল করবে → BULKSMSBD দিয়ে বাংলায় ইউজারের নাম সহ OTP যাবে।
- Input OTP → `supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })` → identity linked।
- `send-sms-hook/index.ts` update: message এ ইউজারের `full_name` include (profile lookup)।

## 3. Password

- Current password field: `supabase.auth.signInWithPassword({ email, password })` দিয়ে reauth verify।
- Google-only ইউজার (no password identity) → শুধু new + confirm field, current field hide, phone linked থাকা required।
- New + confirm → `supabase.auth.updateUser({ password })`।
- Success toast → force sign-out other sessions? না, শুধু password change।

## 4. Active Sessions (2-device limit)

### নতুন table
```
user_sessions (
  id uuid pk,
  user_id uuid → auth.users,
  session_token_hash text unique,  -- Supabase refresh_token এর hash
  device_label text,               -- UA থেকে parse
  ip inet,
  user_agent text,
  created_at, last_seen_at
)
```
RLS: user নিজের row select/delete করতে পারবে।

### Enforcement flow
- **Login/signup সফল হবার সাথে সাথে** (auth-drawer + Google callback + passkey login সব জায়গায়) client একটা server fn `registerSession` কল করবে। এটা refresh_token hash + IP (`getRequestIP`) + UA store করবে।
- Insert-এর আগে user-এর existing sessions count নেয় → যদি ≥ 2 হয়:
  - Server fn error return করবে `{ needsChoice: true, sessions: [...] }`
  - Client "You are logged in on 2 devices" dialog দেখাবে → user একটা select → `revokeSession(id)` কল → তারপর retry registerSession।
- **revokeSession**: `supabaseAdmin.auth.admin.signOut(<session-id>)` টাইপের নেই, তাই আমরা store করব refresh_token নিজেই (hashed) — revoke হলে সেই row delete করব + একটা `session_revocations` broadcast করব যেটা প্রতিটা client `onAuthStateChange`/heartbeat-এ check করে self-signOut করবে।
- **Heartbeat**: `_authenticated` layout-এ প্রতি 60s একবার `pingSession()` — যদি server বলে "revoked" (row নেই), client `supabase.auth.signOut()` করে `/auth` এ পাঠাবে। এভাবে 2-device limit "স্বয়ংক্রিয়ভাবে" enforce হবে।

### Session list UI
Profile-এ 4th section: current session badge + অন্যগুলো "Revoke" button সহ। IP + parsed device (Chrome on Windows) + last_seen relative time।

---

## Technical details

**Files (new/edited):**
- `supabase/migrations/*_user_sessions.sql` — new table + RLS + `count_user_sessions()` helper।
- `src/lib/sessions.functions.ts` — `registerSession`, `listMySessions`, `revokeSession`, `pingSession`।
- `src/lib/sessions.server.ts` — UA parsing helper, hash helper।
- `src/lib/account.functions.ts` — `startPhoneLinkOtp`, `verifyPhoneLinkOtp`, `changePassword`, `setInitialPassword`, `getMyIdentities`।
- `src/lib/passkey.server.ts` — beginRegistration-এ 3-limit check।
- `src/components/account/PasskeysCard.tsx`
- `src/components/account/LinkedAccountsCard.tsx`
- `src/components/account/PasswordCard.tsx`
- `src/components/account/SessionsCard.tsx`
- `src/components/account/SessionChoiceDialog.tsx` — 3rd login এর সময় which to kick
- `src/routes/_authenticated/sdash.profile.tsx` — সব card একত্রিত করবে, existing basic form-এর উপর।
- `src/routes/_authenticated/route.tsx` — heartbeat effect যোগ করবে।
- `src/components/auth-drawer.tsx` — সফল login-এর পরে `registerSession` + choice dialog integration।
- `supabase/functions/send-sms-hook/index.ts` — profile থেকে full_name lookup করে message-এ যোগ।

**Session identifier:** login-এর সময় client `supabase.auth.getSession()` থেকে refresh_token নেবে, server-এ SHA-256 hash পাঠাবে। DB-তে শুধু hash থাকবে — এতে token leak হয় না। Revoke = row delete → heartbeat মিস → client self-signOut।

**Google OAuth callback:** existing OAuth flow-এর পরে root/authenticated layout-এ effect check করবে "just signed in?" → registerSession কল করবে।

**Location:** `getRequestIP({ xForwardedFor: true })` server-side, `user_agent` parse করে "Chrome · Windows 11" টাইপের label বানাব (client-side parsing library ছাড়া, simple regex)।

---

## Out of scope (এই turn-এ নয়)

- Real-time push kick (WebSocket) — heartbeat polling দিয়ে 60s window।
- Geo lookup (city/country) — শুধু IP text দেখাব যেমন request-এ চাওয়া হয়েছে।
- Trusted device / "remember this device" — future।

কনফার্ম করলে বিল্ড শুরু করব।
