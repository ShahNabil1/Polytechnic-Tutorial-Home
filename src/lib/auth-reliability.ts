import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const TRANSIENT_RETRY_DELAYS_MS = [300, 800, 1_600, 3_000];
const SESSION_MIN_VALIDITY_SECONDS = 90;

function messageOf(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const candidate = error as { message?: string; name?: string; error_description?: string; status?: number };
    return [candidate.name, candidate.message, candidate.error_description, candidate.status]
      .filter((part) => part != null && String(part).trim().length > 0)
      .join(" ");
  }
  return String(error);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms + Math.floor(Math.random() * 180)));
}

export function isTransientAuthError(error: unknown): boolean {
  const msg = messageOf(error).toLowerCase();
  return (
    msg.includes("load failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("authretryablefetcherror") ||
    msg.includes("fetcherror") ||
    msg.includes("request timeout") ||
    msg.includes("timeout") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("502")
  );
}

export function friendlyTransientAuthMessage(error: unknown): string {
  if (isTransientAuthError(error)) {
    return "নেটওয়ার্ক/সেশন কানেকশন সাময়িকভাবে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
  }
  return messageOf(error) || "কিছু ভুল হয়েছে, আবার চেষ্টা করুন";
}

export async function withAuthRetry<T>(operation: () => PromiseLike<T>, retries = TRANSIENT_RETRY_DELAYS_MS.length): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientAuthError(error) || attempt >= retries) throw error;
      await wait(TRANSIENT_RETRY_DELAYS_MS[Math.min(attempt, TRANSIENT_RETRY_DELAYS_MS.length - 1)]);
    }
  }
  throw lastError;
}

export async function retrySupabaseAuth<T extends { error: unknown }>(operation: () => PromiseLike<T>): Promise<T> {
  return withAuthRetry(async () => {
    const result = await operation();
    if (result.error && isTransientAuthError(result.error)) throw result.error;
    return result;
  });
}

export function authErrorMessage(error: unknown, fallback = "কিছু ভুল হয়েছে, আবার চেষ্টা করুন"): string {
  const raw = messageOf(error);
  if (isTransientAuthError(error)) {
    return "কানেকশন সাময়িকভাবে ধীর ছিল। আমরা আবার চেষ্টা করেছি — অনুগ্রহ করে আবার সাবমিট করুন।";
  }
  return raw || fallback;
}

export async function getFreshSession(minValiditySeconds = SESSION_MIN_VALIDITY_SECONDS): Promise<Session | null> {
  const { data, error } = await withAuthRetry(() => supabase.auth.getSession());
  if (error) throw error;
  const session = data.session;
  if (!session) return null;

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs > 0 && expiresAtMs - Date.now() < minValiditySeconds * 1000) {
    const refreshed = await retrySupabaseAuth(() => supabase.auth.refreshSession(session));
    if (refreshed.error) throw refreshed.error;
    return refreshed.data.session ?? session;
  }

  return session;
}

export async function getFreshAccessToken(): Promise<string> {
  const session = await getFreshSession();
  const token = session?.access_token;
  if (!token) throw new Error("No active auth session");
  return token;
}

export async function waitForUsableSession(timeoutMs = 6_000): Promise<Session | null> {
  const existing = await getFreshSession().catch(() => null);
  if (existing?.access_token) return existing;

  return new Promise((resolve) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      subscription.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "MFA_CHALLENGE_VERIFIED") return;
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      subscription.subscription.unsubscribe();
      resolve(session ?? null);
    }).data;
  });
}

async function revokeCurrentTrackedSession() {
  const token = await getFreshAccessToken().catch(() => null);
  if (!token) return;

  const commonHeaders = {
    "content-type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const listRes = await fetch("/api/public/sessions/list", { headers: commonHeaders });
  if (!listRes.ok) return;
  const sessions = (await listRes.json().catch(() => [])) as Array<{ id: string; is_current?: boolean }>;
  const current = sessions.find((session) => session.is_current);
  if (!current) return;
  await fetch("/api/public/sessions/revoke", {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify({ id: current.id }),
  }).catch(() => undefined);
}

export async function signOutSafely(): Promise<{ error: unknown | null }> {
  let signOutError: unknown = null;
  await revokeCurrentTrackedSession().catch(() => undefined);

  try {
    const { error } = await retrySupabaseAuth(() => supabase.auth.signOut({ scope: "global" }));
    if (error) signOutError = error;
  } catch (error) {
    signOutError = error;
  }

  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best-effort local cleanup only.
  }

  return { error: signOutError };
}