/**
 * Synthetic placeholder emails are attached to phone-only auth accounts so
 * Supabase admin flows (like generateLink for impersonation) work without a
 * real email. They must never be treated as a real, contactable email:
 * hide them in student-facing UI and skip them for Reset Password / mail flows.
 */
const SYNTHETIC_EMAIL_DOMAIN = "users.polytechnictutorial.local";

export function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith("@" + SYNTHETIC_EMAIL_DOMAIN);
}

/** Returns the email if it's a real, contactable email; null otherwise. */
export function visibleEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return isSyntheticEmail(email) ? null : email;
}
