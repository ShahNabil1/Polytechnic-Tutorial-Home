/**
 * Shared validation for session (device) labels.
 * Used on both the client (SessionsCard) and server (renameSession).
 */
import { z } from "zod";

export const SESSION_LABEL_MIN = 2;
export const SESSION_LABEL_MAX = 40;

/**
 * Allowed: latin letters, digits, spaces, Bangla letters/digits,
 * and a small set of safe punctuation: - _ . , ' ( )
 * Disallows: <, >, /, \, {, }, quotes, control chars, emoji, etc.
 */
// English-only: Bangla is intentionally blocked at the input layer too.
export const SESSION_LABEL_REGEX =
  /^[A-Za-z0-9\s\-_.,'()]+$/u;

export const sessionLabelSchema = z
  .string()
  .trim()
  .min(SESSION_LABEL_MIN, `কমপক্ষে ${SESSION_LABEL_MIN} অক্ষর দিন`)
  .max(SESSION_LABEL_MAX, `সর্বোচ্চ ${SESSION_LABEL_MAX} অক্ষর`)
  .regex(
    SESSION_LABEL_REGEX,
    "শুধু অক্ষর, সংখ্যা, স্পেস এবং - _ . , ' ( ) ব্যবহার করা যাবে",
  )
  // Disallow labels that collapse to only punctuation/whitespace.
  .refine((v) => /[A-Za-z0-9\u0980-\u09FF]/u.test(v), {
    message: "কমপক্ষে একটি অক্ষর বা সংখ্যা দরকার",
  });

export type SessionLabelError = string | null;

/** Returns error message or null if valid. Safe for live validation. */
export function validateSessionLabel(input: string): SessionLabelError {
  const r = sessionLabelSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message ?? "অবৈধ নাম";
}
