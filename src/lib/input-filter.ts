/**
 * Restrict text inputs to English (ASCII) characters only.
 * Bangla, Arabic-Indic digits, emoji and other non-ASCII are stripped
 * silently at the source so IME/paste can never introduce them.
 */

/** Keep only printable ASCII + space. Use for names, roll, registration etc. */
export function toEnglishText(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, "");
}

/** Keep only printable ASCII WITHOUT any whitespace. Use for passwords. */
export function toEnglishPassword(s: string): string {
  return s.replace(/[^\x21-\x7E]/g, "");
}

/** Bangla / Arabic digits → English digits. */
export function toEnglishDigits(s: string): string {
  const map: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return s.replace(/[০-৯٠-٩]/g, (d) => map[d] ?? d);
}

/**
 * Map raw Supabase / auth errors to a friendly Bangla message.
 * Covers the "same as old password" case explicitly so the user
 * knows to pick a genuinely new password.
 */
export function friendlyPasswordError(raw: unknown): string {
  const msg =
    typeof raw === "string"
      ? raw
      : raw instanceof Error
        ? raw.message
        : typeof raw === "object" && raw && "message" in raw
          ? String((raw as { message?: unknown }).message ?? "")
          : String(raw ?? "");
  const m = msg.toLowerCase();

  if (
    m.includes("different from the old") ||
    m.includes("should be different") ||
    m.includes("same_password") ||
    m.includes("same as the old") ||
    m.includes("new password should be different")
  ) {
    return "নতুন পাসওয়ার্ড আগের পাসওয়ার্ড থেকে ভিন্ন হতে হবে। অনুগ্রহ করে এমন একটি পাসওয়ার্ড দিন যা আপনি আগে ব্যবহার করেননি।";
  }

  if (m.includes("password") && (m.includes("weak") || m.includes("should be at least") || m.includes("too short"))) {
    return "পাসওয়ার্ড যথেষ্ট শক্তিশালী নয়। কমপক্ষে ৬ ক্যারেক্টার দিন, বড়/ছোট হাতের অক্ষর ও সংখ্যা মিশিয়ে দিন।";
  }

  if (m.includes("rate limit") || m.includes("too many")) {
    return "অনেক বার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }

  return msg || "পাসওয়ার্ড আপডেট করা যায়নি, আবার চেষ্টা করুন।";
}
