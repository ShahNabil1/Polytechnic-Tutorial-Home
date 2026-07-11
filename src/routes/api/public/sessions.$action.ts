import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { sessionLabelSchema } from "@/lib/session-label";

type ClaimsWithSession = {
  session_id?: string;
  sid?: string;
  sub?: string;
  jti?: string;
};

type AuthedContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  sessionId: string;
};

type ParsedUA = {
  label: string;
  browser: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop";
};

const MAX_DEVICES = 2;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorJson(message: string, status = 400) {
  console.error("[sessions-api]", message);
  return json({ error: message }, status);
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function serverSupabase(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server config missing");

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAuth(request: Request): Promise<AuthedContext> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized");

  const supabase = serverSupabase(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized");

  const claims = data.claims as ClaimsWithSession;
  const sessionId = claims.session_id ?? claims.sid ?? claims.jti;
  if (!sessionId) throw new Error("Session claim missing");

  return { supabase, userId: data.claims.sub, sessionId };
}

function parseUserAgent(ua: string): ParsedUA {
  if (!ua) return { label: "Unknown device", browser: "Unknown", os: "Unknown", device_type: "desktop" };

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg|OPR/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let device_type: ParsedUA["device_type"] = "desktop";
  if (/iPad|Tablet/i.test(ua)) device_type = "tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device_type = "mobile";

  return { label: `${browser} · ${os}`, browser, os, device_type };
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function numberHeader(request: Request, name: string): number | null {
  const value = request.headers.get(name);
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metadata(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const parsed = parseUserAgent(ua);
  return {
    ip: getClientIp(request),
    user_agent: ua,
    browser: parsed.browser,
    os: parsed.os,
    device_type: parsed.device_type,
    device_label: parsed.label,
    country: request.headers.get("cf-ipcountry"),
    region: request.headers.get("cf-region"),
    city: request.headers.get("cf-ipcity"),
    timezone: request.headers.get("cf-timezone"),
    latitude: numberHeader(request, "cf-iplatitude"),
    longitude: numberHeader(request, "cf-iplongitude"),
  };
}

async function register(request: Request, ctx: AuthedContext) {
  const meta = metadata(request);

  const { data: existing, error: existingError } = await ctx.supabase
    .from("user_sessions")
    .select("id")
    .eq("session_token_hash", ctx.sessionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await ctx.supabase
      .from("user_sessions")
      .update({ ...meta, last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  const { data: others, error: othersError } = await ctx.supabase
    .from("user_sessions")
    .select("id, device_label, ip, created_at, last_seen_at")
    .eq("user_id", ctx.userId)
    .order("last_seen_at", { ascending: false });
  if (othersError) throw new Error(othersError.message);

  if ((others?.length ?? 0) >= MAX_DEVICES) {
    return { ok: false as const, needsChoice: true as const, sessions: others ?? [] };
  }

  const { error } = await ctx.supabase.from("user_sessions").insert({
    user_id: ctx.userId,
    session_token_hash: ctx.sessionId,
    ...meta,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

async function list(ctx: AuthedContext) {
  const { data, error } = await ctx.supabase
    .from("user_sessions")
    .select(
      "id, device_label, ip, user_agent, browser, os, device_type, country, region, city, timezone, latitude, longitude, created_at, last_seen_at, session_token_hash",
    )
    .eq("user_id", ctx.userId)
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    device_label: row.device_label,
    ip: row.ip,
    user_agent: row.user_agent,
    browser: row.browser,
    os: row.os,
    device_type: row.device_type,
    country: row.country,
    region: row.region,
    city: row.city,
    timezone: row.timezone,
    latitude: row.latitude,
    longitude: row.longitude,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    is_current: row.session_token_hash === ctx.sessionId,
  }));
}

async function handle(request: Request, action: string) {
  try {
    const ctx = await requireAuth(request);

    if (action === "register") return json(await register(request, ctx));
    if (action === "list") return json(await list(ctx));
    if (action === "ping") {
      const { data, error } = await ctx.supabase
        .from("user_sessions")
        .select("id")
        .eq("session_token_hash", ctx.sessionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ alive: false });
      await ctx.supabase.from("user_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
      return json({ alive: true });
    }

    if (action === "revoke") {
      const body = z.object({ id: z.string().uuid() }).parse(await request.json());
      const { error } = await ctx.supabase.from("user_sessions").delete().eq("id", body.id).eq("user_id", ctx.userId);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "rename") {
      const body = z.object({ id: z.string().uuid(), label: sessionLabelSchema }).parse(await request.json());
      const { error } = await ctx.supabase
        .from("user_sessions")
        .update({ device_label: body.label })
        .eq("id", body.id)
        .eq("user_id", ctx.userId);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "revoke-others") {
      const { data, error } = await ctx.supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", ctx.userId)
        .neq("session_token_hash", ctx.sessionId)
        .select("id");
      if (error) throw new Error(error.message);
      return json({ ok: true, revoked: data?.length ?? 0 });
    }

    return errorJson("Unknown action", 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === "Unauthorized" ? 401 : 500;
    return errorJson(message, status);
  }
}

export const Route = createFileRoute("/api/public/sessions/$action")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handle(request, params.action),
      POST: async ({ request, params }) => handle(request, params.action),
    },
  },
});