/**
 * Session tracking + 2-device limit server functions.
 *
 * Session identity = Supabase JWT `session_id` claim, stored in
 * user_sessions.session_token_hash. Inserts happen via the user's own
 * supabase client (RLS INSERT is denied except via service_role, so we
 * dynamically load the admin client only for the insert).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_DEVICES = 2;

type ClaimsWithSession = {
  session_id?: string;
  sid?: string;
};

function currentSessionId(claims: unknown): string {
  const c = (claims ?? {}) as ClaimsWithSession;
  const id = c.session_id ?? c.sid;
  if (!id) throw new Error("Session claim missing (session_id)");
  return id;
}

/**
 * Called after every successful sign-in.
 * - If the current session is already registered → touch last_seen.
 * - If user has < MAX_DEVICES other sessions → insert.
 * - If user has ≥ MAX_DEVICES other sessions → return needsChoice with the list.
 */
export const registerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = currentSessionId(context.claims);
    const { parseUserAgent, getClientIp, getClientUserAgent } = await import("./sessions.server");
    const ua = getClientUserAgent();
    const ip = getClientIp();
    const label = parseUserAgent(ua);

    // Already registered? Touch last_seen.
    const { data: existing } = await context.supabase
      .from("user_sessions")
      .select("id")
      .eq("session_token_hash", sessionId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (existing) {
      // Touch metadata but keep any user-renamed device_label intact.
      await supabaseAdmin
        .from("user_sessions")
        .update({ last_seen_at: new Date().toISOString(), ip, user_agent: ua })
        .eq("id", existing.id);
      return { ok: true as const };
    }

    // Count other active sessions.
    const { data: others } = await context.supabase
      .from("user_sessions")
      .select("id, device_label, ip, created_at, last_seen_at")
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false });

    if ((others?.length ?? 0) >= MAX_DEVICES) {
      return {
        ok: false as const,
        needsChoice: true as const,
        sessions: others ?? [],
      };
    }

    const { error } = await supabaseAdmin.from("user_sessions").insert({
      user_id: context.userId,
      session_token_hash: sessionId,
      device_label: label,
      ip,
      user_agent: ua,
    });
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });

/** List the user's active sessions. Marks the current one. */
export const listMySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = currentSessionId(context.claims);
    const { data, error } = await context.supabase
      .from("user_sessions")
      .select("id, device_label, ip, user_agent, created_at, last_seen_at, session_token_hash")
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      device_label: row.device_label,
      ip: row.ip,
      user_agent: row.user_agent,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      is_current: row.session_token_hash === sessionId,
    }));
  });

const RevokeSchema = z.object({ id: z.string().uuid() });

/** Revoke a specific session (by row id). Kicked device self-signs-out via heartbeat. */
export const revokeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_sessions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

import { sessionLabelSchema } from "./session-label";

const RenameSchema = z.object({
  id: z.string().uuid(),
  label: sessionLabelSchema,
});

/** Rename a session's device label. */
export const renameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenameSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_sessions")
      .update({ device_label: data.label })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Revoke every session for the user EXCEPT the current one. */
export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = currentSessionId(context.claims);
    const { data, error } = await context.supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", context.userId)
      .neq("session_token_hash", sessionId)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true as const, revoked: data?.length ?? 0 };
  });

/**
 * Heartbeat. Returns { alive: true } if the current session row exists,
 * { alive: false } if it was revoked → client should signOut.
 */
export const pingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = currentSessionId(context.claims);
    const { data } = await context.supabase
      .from("user_sessions")
      .select("id")
      .eq("session_token_hash", sessionId)
      .maybeSingle();
    if (!data) return { alive: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.id);
    return { alive: true as const };
  });
