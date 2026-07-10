// Small client-side capture helper used by the checkout page.
// Debounces server calls while the user is typing, also fires on beforeunload,
// and supports explicit payment-gateway outcomes (cancelled/failed/timeout).

import { captureIncompleteCheckout } from "@/lib/orders.functions";
import { computeFingerprint } from "@/lib/fingerprint";

export type CheckoutOutcome =
  | "abandoned"
  | "pending"
  | "cancelled"
  | "failed"
  | "timeout";

export type IncompleteSnapshot = {
  customer: {
    name?: string;
    phone: string;
    email?: string;
    division?: string;
    district?: string;
    upazila?: string;
    address?: string;
  };
  items: Array<{
    productId: string;
    title: string;
    unitPrice: number;
    quantity: number;
    image?: string;
  }>;
  totals: { subtotal: number; shipping: number; total: number };
  userId?: string | null;
  outcome?: CheckoutOutcome;
  gatewayRef?: string;
};

let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let latest: IncompleteSnapshot | null = null;
let cachedFingerprint: string | null = null;

async function fpOnce() {
  if (cachedFingerprint != null) return cachedFingerprint;
  try {
    cachedFingerprint = await computeFingerprint();
  } catch {
    cachedFingerprint = "";
  }
  return cachedFingerprint;
}

export function queueIncompleteCapture(snapshot: IncompleteSnapshot, delayMs = 1500) {
  latest = snapshot;
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(async () => {
    if (!latest) return;
    const payload = latest;
    try {
      const fingerprint = await fpOnce();
      await captureIncompleteCheckout({ data: { ...payload, fingerprint } });
    } catch {
      /* fire-and-forget */
    }
  }, delayMs);
}

export function flushIncompleteCaptureNow() {
  if (!latest) return;
  const payload = latest;
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
  try {
    captureIncompleteCheckout({ data: { ...payload, fingerprint: cachedFingerprint ?? "" } });
  } catch {
    /* ignore */
  }
}

/**
 * Record an explicit payment-gateway outcome (cancelled / failed / timeout / pending).
 * Awaited so the return page can show a definite state before redirecting.
 */
export async function recordCheckoutOutcome(
  snapshot: IncompleteSnapshot,
  outcome: CheckoutOutcome,
  gatewayRef?: string,
) {
  try {
    const fingerprint = await fpOnce();
    await captureIncompleteCheckout({
      data: { ...snapshot, fingerprint, outcome, gatewayRef },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function resetIncompleteCapture() {
  latest = null;
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
}

/** Stash last snapshot to sessionStorage so gateway-return pages can find it. */
export function stashSnapshotForReturn(snapshot: IncompleteSnapshot) {
  try {
    sessionStorage.setItem("pth_checkout_snapshot", JSON.stringify(snapshot));
  } catch {}
}

export function readStashedSnapshot(): IncompleteSnapshot | null {
  try {
    const raw = sessionStorage.getItem("pth_checkout_snapshot");
    return raw ? (JSON.parse(raw) as IncompleteSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearStashedSnapshot() {
  try {
    sessionStorage.removeItem("pth_checkout_snapshot");
  } catch {}
}

