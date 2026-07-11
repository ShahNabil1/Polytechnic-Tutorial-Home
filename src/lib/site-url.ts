/**
 * Canonical public site URL. Used to build customer-facing links (receipts,
 * order pages) inside SMS/email templates so preview/admin origins never
 * leak into messages sent to real customers.
 */
export const SITE_URL = "https://polytechnictutorial.com";

export function receiptUrl(orderNo: string): string {
  return `${SITE_URL}/checkout/success?order=${encodeURIComponent(orderNo)}`;
}
