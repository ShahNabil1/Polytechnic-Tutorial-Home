/**
 * Server-only passkey (WebAuthn) helpers.
 * Contains: RP config derivation, challenge storage, credential lookup,
 * Supabase session issuance (custom JWT + refresh_token/session rows).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignJWT } from "jose";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

const CHALLENGE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h

const admin = () => supabaseAdmin;

// -------------------- RP / origin --------------------

export function getRpConfig() {
  // Prefer browser's Origin header (this is what WebAuthn signs).
  const origin =
    getRequestHeader("origin") ||
    getRequestHeader("referer") ||
    new URL(getRequest().url).origin;
  const url = new URL(origin);
  return {
    rpID: url.hostname,
    origin: url.origin,
    rpName: "PTH — Polytechnic Tutorial Hub",
  };
}

// -------------------- Base64URL helpers --------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// -------------------- Challenge storage --------------------

async function storeChallenge(args: {
  challenge: string;
  purpose: "register" | "authenticate";
  userId?: string | null;
  phone?: string | null;
}) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  // Clean expired for the same scope
  await admin()
    .from("webauthn_challenges")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const { error } = await admin().from("webauthn_challenges").insert({
    challenge: args.challenge,
    purpose: args.purpose,
    user_id: args.userId ?? null,
    phone: args.phone ?? null,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Challenge store failed: ${error.message}`);
}

async function consumeChallenge(args: {
  purpose: "register" | "authenticate";
  userId?: string | null;
  phone?: string | null;
}): Promise<string> {
  let q = admin()
    .from("webauthn_challenges")
    .select("challenge, expires_at")
    .eq("purpose", args.purpose)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.userId) q = q.eq("user_id", args.userId);
  if (args.phone) q = q.eq("phone", args.phone);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`Challenge lookup failed: ${error.message}`);
  if (!data) throw new Error("Challenge not found or expired");
  // Delete this specific challenge
  await admin().from("webauthn_challenges").delete().eq("challenge", data.challenge);
  return data.challenge;
}

// -------------------- Registration --------------------

export async function beginRegistration(userId: string) {
  const rp = getRpConfig();
  const { data: user } = await admin().auth.admin.getUserById(userId);
  const userName = user?.user?.phone || user?.user?.email || userId;

  const { data: existing } = await admin()
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", userId);

  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransport[]) || undefined,
    })),
  });

  await storeChallenge({
    challenge: options.challenge,
    purpose: "register",
    userId,
  });

  return options;
}

export async function finishRegistration(args: {
  userId: string;
  response: RegistrationResponseJSON;
  deviceName?: string;
}) {
  const rp = getRpConfig();
  const expectedChallenge = await consumeChallenge({
    purpose: "register",
    userId: args.userId,
  });

  const verification = await verifyRegistrationResponse({
    response: args.response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration failed verification");
  }

  const { credential } = verification.registrationInfo;
  const credentialId = credential.id; // base64url
  const publicKey = toBase64Url(credential.publicKey);
  const counter = credential.counter ?? 0;
  const transports = args.response.response.transports ?? [];

  const { error } = await admin().from("webauthn_credentials").insert({
    user_id: args.userId,
    credential_id: credentialId,
    public_key: publicKey,
    counter,
    transports,
    device_name: args.deviceName ?? null,
  });
  if (error) throw new Error(`Save passkey failed: ${error.message}`);

  return { verified: true };
}

// -------------------- Authentication (login) --------------------

export async function beginAuthentication(phone: string) {
  const rp = getRpConfig();

  // Find user by phone via admin API
  const { data: userList } = await admin().auth.admin.listUsers({ perPage: 1 });
  // listUsers doesn't filter by phone; use SQL via a raw query on auth.users
  let userId: string | null = null;
  {
    const { data } = await admin()
      .schema("auth" as never)
      .from("users" as never)
      .select("id")
      .eq("phone", phone.replace(/^\+/, ""))
      .maybeSingle();
    userId = (data as { id?: string } | null)?.id ?? null;
    // Supabase sometimes stores phone with or without leading '+'
    if (!userId) {
      const { data: d2 } = await admin()
        .schema("auth" as never)
        .from("users" as never)
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      userId = (d2 as { id?: string } | null)?.id ?? null;
    }
  }
  void userList;

  let credentials: { credential_id: string; transports: string[] }[] = [];
  if (userId) {
    const { data } = await admin()
      .from("webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", userId);
    credentials = data ?? [];
  }

  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "preferred",
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: (c.transports as AuthenticatorTransport[]) || undefined,
    })),
  });

  await storeChallenge({
    challenge: options.challenge,
    purpose: "authenticate",
    phone,
  });

  return options;
}

export async function finishAuthentication(args: {
  phone: string;
  response: AuthenticationResponseJSON;
}) {
  const rp = getRpConfig();
  const expectedChallenge = await consumeChallenge({
    purpose: "authenticate",
    phone: args.phone,
  });

  const credentialId = args.response.id;
  const { data: cred, error: credErr } = await admin()
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (credErr) throw new Error(`Credential lookup failed: ${credErr.message}`);
  if (!cred) throw new Error("এই ডিভাইসের Passkey রেজিস্টার্ড নেই");

  const verification = await verifyAuthenticationResponse({
    response: args.response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    credential: {
      id: cred.credential_id,
      publicKey: fromBase64Url(cred.public_key),
      counter: Number(cred.counter),
      transports: (cred.transports as AuthenticatorTransport[]) || undefined,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) throw new Error("Passkey verification failed");

  // Update counter + last_used
  await admin()
    .from("webauthn_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  // Mint a Supabase session for this user
  return await issueSupabaseSession(cred.user_id);
}

// -------------------- Supabase session issuance --------------------

async function issueSupabaseSession(userId: string) {
  const secret = process.env.SB_JWT_SIGNING_SECRET;
  if (!secret) throw new Error("SB_JWT_SIGNING_SECRET is not configured");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("SUPABASE_URL not configured");

  const { data: userRes, error: userErr } = await admin().auth.admin.getUserById(userId);
  if (userErr || !userRes?.user) throw new Error("User lookup failed");
  const user = userRes.user;

  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const userAgent = getRequestHeader("user-agent") || "passkey";

  // 1) Create session row
  {
    const { error } = await admin()
      .schema("auth" as never)
      .from("sessions" as never)
      .insert({
        id: sessionId,
        user_id: userId,
        aal: "aal1",
        created_at: nowIso,
        updated_at: nowIso,
        refreshed_at: nowIso,
        user_agent: userAgent,
      } as never);
    if (error) throw new Error(`Session create failed: ${error.message}`);
  }

  // 2) Create refresh_token row
  const refreshToken =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  {
    const { error } = await admin()
      .schema("auth" as never)
      .from("refresh_tokens" as never)
      .insert({
        token: refreshToken,
        user_id: userId,
        session_id: sessionId,
        revoked: false,
        created_at: nowIso,
        updated_at: nowIso,
      } as never);
    if (error) throw new Error(`Refresh token create failed: ${error.message}`);
  }

  // 3) Sign access token JWT
  const payload = {
    iss: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
    sub: userId,
    aud: "authenticated",
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iat: now,
    email: user.email ?? "",
    phone: user.phone ?? "",
    app_metadata: user.app_metadata ?? { provider: "phone", providers: ["phone"] },
    user_metadata: user.user_metadata ?? {},
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "passkey", timestamp: now }],
    session_id: sessionId,
    is_anonymous: false,
  };

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(new TextEncoder().encode(secret) as unknown as Uint8Array);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    token_type: "bearer",
    user_id: userId,
  };
}
