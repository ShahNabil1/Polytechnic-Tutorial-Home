/**
 * Step-up reauthentication.
 * The user must prove identity (password or passkey) again before sensitive
 * account changes. A successful reauth is cached in sessionStorage for
 * REAUTH_TTL_MS so a burst of related edits doesn't spam the prompt.
 */
const REAUTH_KEY = "sec:reauthed_at";
const REAUTH_TTL_MS = 5 * 60 * 1000; // 5 minutes

let opener: (() => Promise<boolean>) | null = null;
let methodsAvailable = true;

/** ReauthDialogHost registers itself here on mount. */
export function registerReauthDialog(fn: () => Promise<boolean>) {
  opener = fn;
}

/** Host tells us whether any reauth method (password/passkey) is set. */
export function setReauthMethodsAvailable(available: boolean) {
  methodsAvailable = available;
}

export function isReauthFresh(): boolean {
  if (typeof window === "undefined") return false;
  const t = Number(sessionStorage.getItem(REAUTH_KEY) || 0);
  return t > 0 && Date.now() - t < REAUTH_TTL_MS;
}

export function markReauthed() {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(REAUTH_KEY, String(Date.now()));
  }
}

export function clearReauth() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(REAUTH_KEY);
  }
}

/**
 * Gate a sensitive action. Resolves to true if the user is (or becomes)
 * freshly reauthenticated. Returns false when the user cancels.
 */
export async function ensureReauth(): Promise<boolean> {
  if (isReauthFresh()) return true;
  // If the user has no password AND no passkey, there's nothing to reauth
  // against — trust the current session (e.g. Google-only bootstrap flow).
  if (!methodsAvailable) return true;
  if (!opener) {
    console.warn("[reauth] no dialog host mounted");
    return false;
  }
  return opener();
}
