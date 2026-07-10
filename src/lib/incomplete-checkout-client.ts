// Small client-side capture helper used by the checkout page.
// Debounces server calls while the user is typing, and also fires on beforeunload.

import { captureIncompleteCheckout } from "@/lib/orders.functions";
import { computeFingerprint } from "@/lib/fingerprint";

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
  // Best-effort fire-and-forget during unload.
  try {
    captureIncompleteCheckout({ data: { ...payload, fingerprint: cachedFingerprint ?? "" } });
  } catch {
    /* ignore */
  }
}

export function resetIncompleteCapture() {
  latest = null;
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = null;
  }
}
