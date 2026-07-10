/**
 * Server-only passkey (WebAuthn) helpers.
 *
 * This file intentionally avoids @simplewebauthn/server. That package pulls in
 * ASN.1 helpers that depend on tslib conditional exports, which can crash the
 * deployed SSR worker during module initialization.
 */
import { SignJWT } from "jose";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type RegistrationResponseJSON = {
  id: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: AuthenticatorTransport[];
  };
};

type AuthenticationResponseJSON = {
  id: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
  };
};

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number | string | null;
  transports: string[] | null;
};

type AppSupabaseClient = SupabaseClient<Database>;

const CHALLENGE_TTL_SECONDS = 5 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function readFirstConfiguredSecret(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (!value) continue;
    return value.split(",").map((part) => part.trim()).find(Boolean) ?? value;
  }
  return undefined;
}

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = readFirstConfiguredSecret(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET_KEYS",
  );

  if (!supabaseUrl || !serviceKey) {
    const missing = [
      ...(!supabaseUrl ? ["SUPABASE_URL"] : []),
      ...(!serviceKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    global: { fetch: createSupabaseFetch(serviceKey) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let adminClient: ReturnType<typeof createAdminClient> | undefined;
const admin = () => {
  adminClient ??= createAdminClient();
  return adminClient;
};

export function getRpConfig() {
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

function randomBase64Url(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  const input = typeof data === "string" ? textEncoder.encode(data) : data;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input as BufferSource));
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

class CborReader {
  pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  read(): unknown {
    if (this.pos >= this.bytes.length) throw new Error("CBOR data ended early");
    const initial = this.bytes[this.pos++];
    const major = initial >> 5;
    const additional = initial & 0x1f;

    if (major === 0) return this.readLength(additional);
    if (major === 1) return -1 - this.readLength(additional);
    if (major === 2) {
      const length = this.readLength(additional);
      const end = this.pos + length;
      if (end > this.bytes.length) throw new Error("Invalid CBOR byte string");
      const value = this.bytes.slice(this.pos, end);
      this.pos = end;
      return value;
    }
    if (major === 3) {
      const length = this.readLength(additional);
      const end = this.pos + length;
      if (end > this.bytes.length) throw new Error("Invalid CBOR text string");
      const value = textDecoder.decode(this.bytes.slice(this.pos, end));
      this.pos = end;
      return value;
    }
    if (major === 4) {
      const length = this.readLength(additional);
      const value: unknown[] = [];
      for (let i = 0; i < length; i++) value.push(this.read());
      return value;
    }
    if (major === 5) {
      const length = this.readLength(additional);
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < length; i++) map.set(this.read(), this.read());
      return map;
    }
    if (major === 7) {
      if (additional === 20) return false;
      if (additional === 21) return true;
      if (additional === 22) return null;
      if (additional === 23) return undefined;
    }
    throw new Error(`Unsupported CBOR value: major=${major}, additional=${additional}`);
  }

  private readLength(additional: number): number {
    if (additional < 24) return additional;
    if (additional === 24) return this.takeInt(1);
    if (additional === 25) return this.takeInt(2);
    if (additional === 26) return this.takeInt(4);
    if (additional === 27) {
      const high = this.takeInt(4);
      const low = this.takeInt(4);
      const value = high * 0x100000000 + low;
      if (!Number.isSafeInteger(value)) throw new Error("CBOR integer is too large");
      return value;
    }
    throw new Error("Indefinite CBOR lengths are not supported");
  }

  private takeInt(length: number): number {
    if (this.pos + length > this.bytes.length) throw new Error("CBOR data ended early");
    let value = 0;
    for (let i = 0; i < length; i++) value = value * 256 + this.bytes[this.pos++];
    return value;
  }
}

function decodeCbor(bytes: Uint8Array): unknown {
  const reader = new CborReader(bytes);
  return reader.read();
}

function decodeCborWithLength(bytes: Uint8Array): { readBytes: number } {
  const reader = new CborReader(bytes);
  reader.read();
  return { readBytes: reader.pos };
}

function getMapValue<T>(map: unknown, key: string | number): T {
  if (!(map instanceof Map) || !map.has(key)) throw new Error(`CBOR map is missing ${String(key)}`);
  return map.get(key) as T;
}

function parseClientData(args: {
  encoded: string;
  expectedType: "webauthn.create" | "webauthn.get";
  expectedChallenge: string;
  expectedOrigin: string;
}): Uint8Array {
  const bytes = fromBase64Url(args.encoded);
  const parsed = JSON.parse(textDecoder.decode(bytes)) as {
    type?: string;
    challenge?: string;
    origin?: string;
    crossOrigin?: boolean;
  };
  if (parsed.type !== args.expectedType) throw new Error("Invalid WebAuthn response type");
  if (parsed.challenge !== args.expectedChallenge) throw new Error("Invalid WebAuthn challenge");
  if (parsed.origin !== args.expectedOrigin) throw new Error("Invalid WebAuthn origin");
  if (parsed.crossOrigin === true) throw new Error("Cross-origin WebAuthn responses are not allowed");
  return bytes;
}

async function parseAuthenticatorData(authData: Uint8Array, rpID: string) {
  if (authData.length < 37) throw new Error("Authenticator data is too short");
  const expectedRpHash = await sha256(rpID);
  if (!bytesEqual(authData.slice(0, 32), expectedRpHash)) throw new Error("Invalid WebAuthn RP ID");
  const flags = authData[32];
  if ((flags & 0x01) !== 0x01) throw new Error("User presence was not verified");
  return {
    flags,
    counter: readUint32(authData, 33),
  };
}

function extractRegistrationCredential(authData: Uint8Array) {
  const flags = authData[32];
  if ((flags & 0x40) !== 0x40) throw new Error("Registration response has no credential data");
  let offset = 37 + 16;
  if (authData.length < offset + 2) throw new Error("Credential data is incomplete");
  const credentialIdLength = (authData[offset] << 8) | authData[offset + 1];
  offset += 2;
  const credentialId = authData.slice(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  if (credentialId.length !== credentialIdLength) throw new Error("Credential ID is incomplete");
  const publicKeySlice = authData.slice(offset);
  const { readBytes } = decodeCborWithLength(publicKeySlice);
  return { credentialId, publicKey: publicKeySlice.slice(0, readBytes) };
}

function readDerLength(bytes: Uint8Array, offset: number): { length: number; offset: number } {
  const first = bytes[offset++];
  if (first < 0x80) return { length: first, offset };
  const count = first & 0x7f;
  let length = 0;
  for (let i = 0; i < count; i++) length = length * 256 + bytes[offset++];
  return { length, offset };
}

function derToP1363(signature: Uint8Array, size = 32): Uint8Array {
  if (signature.length === size * 2) return signature;
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("Invalid ECDSA signature");
  const sequence = readDerLength(signature, offset);
  offset = sequence.offset;
  void sequence;

  const readInteger = () => {
    if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA signature integer");
    const part = readDerLength(signature, offset);
    offset = part.offset;
    let value = signature.slice(offset, offset + part.length);
    offset += part.length;
    while (value.length > 0 && value[0] === 0) value = value.slice(1);
    if (value.length > size) throw new Error("ECDSA signature integer is too long");
    const out = new Uint8Array(size);
    out.set(value, size - value.length);
    return out;
  };

  return concatBytes(readInteger(), readInteger());
}

async function importCosePublicKey(cosePublicKey: Uint8Array): Promise<{
  key: CryptoKey;
  algorithm: EcdsaParams | RsaHashedImportParams;
  normalizeSignature: (signature: Uint8Array) => Uint8Array;
}> {
  const cose = decodeCbor(cosePublicKey);
  const kty = getMapValue<number>(cose, 1);
  const alg = getMapValue<number>(cose, 3);

  if (kty === 2 && alg === -7) {
    const crv = getMapValue<number>(cose, -1);
    if (crv !== 1) throw new Error("Only P-256 passkeys are supported");
    const x = getMapValue<Uint8Array>(cose, -2);
    const y = getMapValue<Uint8Array>(cose, -3);
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: toBase64Url(x), y: toBase64Url(y), ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return {
      key,
      algorithm: { name: "ECDSA", hash: "SHA-256" },
      normalizeSignature: (signature) => derToP1363(signature, 32),
    };
  }

  if (kty === 3 && alg === -257) {
    const n = getMapValue<Uint8Array>(cose, -1);
    const e = getMapValue<Uint8Array>(cose, -2);
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: toBase64Url(n), e: toBase64Url(e), alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return {
      key,
      algorithm: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      normalizeSignature: (signature) => signature,
    };
  }

  throw new Error("Unsupported passkey algorithm");
}

async function storeChallenge(args: {
  supabase?: AppSupabaseClient;
  challenge: string;
  purpose: "register" | "authenticate";
  userId?: string | null;
  phone?: string | null;
}) {
  const client = args.supabase ?? admin();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
  let cleanup = client.from("webauthn_challenges").delete().lt("expires_at", new Date().toISOString());
  if (args.userId) cleanup = cleanup.eq("user_id", args.userId);
  if (args.phone) cleanup = cleanup.eq("phone", args.phone);
  await cleanup;
  const { error } = await client.from("webauthn_challenges").insert({
    challenge: args.challenge,
    purpose: args.purpose,
    user_id: args.userId ?? null,
    phone: args.phone ?? null,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Challenge store failed: ${error.message}`);
}

async function consumeChallenge(args: {
  supabase?: AppSupabaseClient;
  purpose: "register" | "authenticate";
  userId?: string | null;
  phone?: string | null;
  /** When set, matches on the challenge value directly (used by discoverable auth). */
  challenge?: string;
}): Promise<string> {
  const client = args.supabase ?? admin();
  let q = client
    .from("webauthn_challenges")
    .select("challenge, expires_at")
    .eq("purpose", args.purpose)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.challenge) q = q.eq("challenge", args.challenge);
  if (args.userId) q = q.eq("user_id", args.userId);
  if (args.phone) q = q.eq("phone", args.phone);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`Challenge lookup failed: ${error.message}`);
  if (!data) throw new Error("Challenge not found or expired");
  await client.from("webauthn_challenges").delete().eq("challenge", data.challenge);
  return data.challenge;
}

async function findUserIdByPhone(phone: string): Promise<string | null> {
  const normalized = phone.replace(/^\+/, "");
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`User lookup failed: ${error.message}`);
    const match = data.users.find((user) => {
      const userPhone = user.phone ?? "";
      return userPhone === phone || userPhone.replace(/^\+/, "") === normalized;
    });
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function beginRegistration(args: {
  supabase: AppSupabaseClient;
  userId: string;
  userName: string;
}) {
  const rp = getRpConfig();

  const { data: existing, error: existingError } = await args.supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", args.userId);
  if (existingError) throw new Error(`Passkey lookup failed: ${existingError.message}`);

  if ((existing?.length ?? 0) >= 3) {
    throw new Error("সর্বোচ্চ ৩টা Passkey রাখা যাবে। নতুন যোগ করতে আগে একটা রিমুভ করুন।");
  }

  const challenge = randomBase64Url();
  await storeChallenge({ supabase: args.supabase, challenge, purpose: "register", userId: args.userId });

  return {
    challenge,
    rp: { name: rp.rpName, id: rp.rpID },
    user: {
      id: toBase64Url(textEncoder.encode(args.userId)),
      name: args.userName,
      displayName: args.userName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: CHALLENGE_TTL_SECONDS * 1000,
    attestation: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      type: "public-key",
      transports: (c.transports as AuthenticatorTransport[]) || undefined,
    })),
  };
}

export async function finishRegistration(args: {
  supabase: AppSupabaseClient;
  userId: string;
  phone?: string | null;
  response: RegistrationResponseJSON;
  deviceName?: string;
}) {
  const rp = getRpConfig();
  const expectedChallenge = await consumeChallenge({
    supabase: args.supabase,
    purpose: "register",
    userId: args.userId,
  });

  parseClientData({
    encoded: args.response.response.clientDataJSON,
    expectedType: "webauthn.create",
    expectedChallenge,
    expectedOrigin: rp.origin,
  });

  const attestation = decodeCbor(fromBase64Url(args.response.response.attestationObject));
  const authData = getMapValue<Uint8Array>(attestation, "authData");
  await parseAuthenticatorData(authData, rp.rpID);
  const { credentialId, publicKey } = extractRegistrationCredential(authData);
  const credentialIdString = toBase64Url(credentialId);
  if (credentialIdString !== args.response.id) throw new Error("Credential ID mismatch");

  const { error } = await args.supabase.from("webauthn_credentials").insert({
    user_id: args.userId,
    phone: args.phone ?? null,
    credential_id: credentialIdString,
    public_key: toBase64Url(publicKey),
    counter: readUint32(authData, 33),
    transports: args.response.response.transports ?? [],
    device_name: args.deviceName ?? null,
  });
  if (error) throw new Error(`Save passkey failed: ${error.message}`);

  return { verified: true };
}

/**
 * Begin authentication.
 *
 * If `phone` is provided, we scope `allowCredentials` to that user (legacy
 * flow). If it is omitted, we return an empty `allowCredentials` list — this
 * is the WebAuthn "discoverable credential" flow. The browser then lets the
 * OS pick the resident passkey automatically; the user doesn't have to type
 * a phone number or email first.
 */
export async function beginAuthentication(phone?: string | null) {
  const rp = getRpConfig();

  let credentials: { credential_id: string; transports: string[] | null }[] = [];
  if (phone) {
    const userId = await findUserIdByPhone(phone);
    if (userId) {
      const { data } = await admin()
        .from("webauthn_credentials")
        .select("credential_id, transports")
        .eq("user_id", userId);
      credentials = data ?? [];
    }
  }

  const challenge = randomBase64Url();
  await storeChallenge({ challenge, purpose: "authenticate", phone: phone ?? null });

  return {
    challenge,
    timeout: CHALLENGE_TTL_SECONDS * 1000,
    rpId: rp.rpID,
    // Require verification for discoverable flow so the passkey acts as a
    // full first-factor sign-in.
    userVerification: phone ? "preferred" : "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      type: "public-key",
      transports: (c.transports as AuthenticatorTransport[]) || undefined,
    })),
  };
}

export async function finishAuthentication(args: {
  phone?: string | null;
  response: AuthenticationResponseJSON;
}) {
  const rp = getRpConfig();

  // Look up the credential first — its record tells us which user is
  // signing in, which is required for the discoverable flow (no phone).
  const { data: cred, error: credErr } = await admin()
    .from("webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", args.response.id)
    .maybeSingle<CredentialRow>();
  if (credErr) throw new Error(`Credential lookup failed: ${credErr.message}`);
  if (!cred) throw new Error("এই Passkey রেজিস্টার্ড নেই");

  // Decode the returned clientData to read the challenge the authenticator
  // signed — then match it back to a stored authenticate-challenge row.
  const clientDataRaw = fromBase64Url(args.response.response.clientDataJSON);
  const clientDataParsed = JSON.parse(textDecoder.decode(clientDataRaw)) as {
    challenge?: string;
  };
  if (!clientDataParsed.challenge) throw new Error("Missing challenge in client data");

  const expectedChallenge = await consumeChallenge({
    purpose: "authenticate",
    challenge: clientDataParsed.challenge,
  });

  const clientDataBytes = parseClientData({
    encoded: args.response.response.clientDataJSON,
    expectedType: "webauthn.get",
    expectedChallenge,
    expectedOrigin: rp.origin,
  });
  const authData = fromBase64Url(args.response.response.authenticatorData);
  const parsedAuthData = await parseAuthenticatorData(authData, rp.rpID);
  const signedData = concatBytes(authData, await sha256(clientDataBytes));
  const verifier = await importCosePublicKey(fromBase64Url(cred.public_key));
  const signature = verifier.normalizeSignature(fromBase64Url(args.response.response.signature));

  const verified = await crypto.subtle.verify(
    verifier.algorithm,
    verifier.key,
    signature as BufferSource,
    signedData as BufferSource,
  );
  if (!verified) throw new Error("Passkey verification failed");

  const oldCounter = Number(cred.counter ?? 0);
  if (oldCounter > 0 && parsedAuthData.counter > 0 && parsedAuthData.counter <= oldCounter) {
    throw new Error("Passkey counter check failed");
  }

  await admin()
    .from("webauthn_credentials")
    .update({
      counter: parsedAuthData.counter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", cred.id);

  return await issueSupabaseSession(cred.user_id);
}

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

  const { error: sessionError } = await admin()
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
  if (sessionError) throw new Error(`Session create failed: ${sessionError.message}`);

  const refreshToken =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error: refreshError } = await admin()
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
  if (refreshError) throw new Error(`Refresh token create failed: ${refreshError.message}`);

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
    .sign(textEncoder.encode(secret));

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    token_type: "bearer",
    user_id: userId,
  };
}