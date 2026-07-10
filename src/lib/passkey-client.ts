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

const SERVER_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), SERVER_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
  const options = await withTimeout(
    getPasskeyRegistrationOptions(),
    "Passkey সেটআপ শুরু হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attResp = await startRegistration({ optionsJSON: options as any });
  await withTimeout(
    verifyPasskeyRegistration({
      data: { response: attResp, deviceName: deviceName ?? defaultDeviceName() },
    }),
    "Passkey সেভ হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
  );
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
  const options = await withTimeout(
    getPasskeyAuthOptions({ data: { phone: phone ?? null } }),
    "Passkey লগইন শুরু হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asseResp = await startAuthentication({ optionsJSON: options as any });
  const tokens = await withTimeout(
    verifyPasskeyAuthentication({
      data: { phone: phone ?? null, response: asseResp },
    }),
    "Passkey যাচাই হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
  );
  const { error } = await withTimeout(
    supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }),
    "সেশন চালু হতে বেশি সময় লাগছে। আবার চেষ্টা করুন।",
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}
