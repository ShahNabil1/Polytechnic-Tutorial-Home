import { supabase } from "@/integrations/supabase/client";

export type TrackedSession = {
  id: string;
  device_label: string | null;
  ip: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
};

export type RegisterSessionResult =
  | { ok: true }
  | { ok: false; needsChoice: true; sessions: Array<Pick<TrackedSession, "id" | "device_label" | "ip" | "created_at" | "last_seen_at">> }
  | { ok: false };

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No active auth session");

  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    throw new Error((json && "error" in json && json.error) || `Request failed (${res.status})`);
  }
  return json as T;
}

export function registerTrackedSession() {
  return authFetch<RegisterSessionResult>("/api/public/sessions/register", { method: "POST" });
}

export function listTrackedSessions() {
  return authFetch<TrackedSession[]>("/api/public/sessions/list", { method: "GET" });
}

export function pingTrackedSession() {
  return authFetch<{ alive: boolean }>("/api/public/sessions/ping", { method: "POST" });
}

export function revokeTrackedSession(id: string) {
  return authFetch<{ ok: true }>("/api/public/sessions/revoke", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function renameTrackedSession(id: string, label: string) {
  return authFetch<{ ok: true }>("/api/public/sessions/rename", {
    method: "POST",
    body: JSON.stringify({ id, label }),
  });
}

export function revokeOtherTrackedSessions() {
  return authFetch<{ ok: true; revoked: number }>("/api/public/sessions/revoke-others", { method: "POST" });
}