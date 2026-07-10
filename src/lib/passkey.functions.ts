/**
 * Passkey server functions (thin wrappers).
 * Handler bodies load ./passkey.server via dynamic import so the server-only
 * module never enters client bundles via top-level import chains.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Register options (auth required) ----
export const getPasskeyRegistrationOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginRegistration } = await import("./passkey.server");
    const claims = context.claims as { phone?: string; email?: string; user_metadata?: { full_name?: string } };
    const userName = claims.phone || claims.email || claims.user_metadata?.full_name || context.userId;
    return beginRegistration({ supabase: context.supabase, userId: context.userId, userName });
  });

// ---- Register verify (auth required) ----
const RegisterVerifySchema = z.object({
  response: z.any(),
  deviceName: z.string().max(100).optional(),
});

export const verifyPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RegisterVerifySchema.parse(input))
  .handler(async ({ context, data }) => {
    const { finishRegistration } = await import("./passkey.server");
    const claims = context.claims as { phone?: string };
    return finishRegistration({
      supabase: context.supabase,
      userId: context.userId,
      phone: claims.phone ?? null,
      response: data.response,
      deviceName: data.deviceName,
    });
  });

// ---- Authenticate options (public) ----
// Phone is optional — when omitted, the server returns an empty
// `allowCredentials` list so the browser can pick any resident passkey
// (discoverable / usernameless flow).
const AuthOptionsSchema = z.object({
  phone: z.string().min(4).max(20).optional().nullable(),
});

export const getPasskeyAuthOptions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuthOptionsSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { beginAuthentication } = await import("./passkey.server");
    return beginAuthentication(data.phone ?? null);
  });

// ---- Authenticate verify (public) — returns Supabase session tokens ----
const AuthVerifySchema = z.object({
  phone: z.string().min(4).max(20).optional().nullable(),
  response: z.any(),
});

export const verifyPasskeyAuthentication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuthVerifySchema.parse(input))
  .handler(async ({ data }) => {
    const { finishAuthentication } = await import("./passkey.server");
    return finishAuthentication({
      phone: data.phone ?? null,
      response: data.response,
    });
  });

// ---- List / delete own passkeys (auth required) ----
export const listMyPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DeleteSchema = z.object({ id: z.string().uuid() });
export const deleteMyPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("webauthn_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
