/**
 * Client-side passkey helpers using @simplewebauthn/browser.
 */
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";
import {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthOptions,
  verifyPasskeyAuthentication,
} from "@/lib/passkey.functions";

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

function defaultDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS ডিভাইস";
  if (/Android/i.test(ua)) return "Android ডিভাইস";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "এই ডিভাইস";
}

/** Register a new passkey for the currently signed-in user. */
export async function registerPasskey(deviceName?: string) {
  if (!isPasskeySupported()) throw new Error("এই ব্রাউজারে Passkey সাপোর্ট নেই");
  const options = await getPasskeyRegistrationOptions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attResp = await startRegistration({ optionsJSON: options as any });
  await verifyPasskeyRegistration({
    data: { response: attResp, deviceName: deviceName ?? defaultDeviceName() },
  });
  return { ok: true };
}

/**
 * Sign in with a passkey.
 *
 * Discoverable (usernameless) by default — the browser/OS picks a resident
 * passkey and the user only sees the native prompt. Pass a phone number
 * only for the legacy phone-scoped flow.
 */
export async function signInWithPasskey(phone?: string) {
  if (!isPasskeySupported()) throw new Error("এই ব্রাউজারে Passkey সাপোর্ট নেই");
  const options = await getPasskeyAuthOptions({ data: { phone: phone ?? null } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asseResp = await startAuthentication({ optionsJSON: options as any });
  const tokens = await verifyPasskeyAuthentication({
    data: { phone: phone ?? null, response: asseResp },
  });
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
