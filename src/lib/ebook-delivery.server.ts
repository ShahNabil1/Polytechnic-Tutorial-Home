// Server-only helpers for the ebook auto-delivery pipeline.
// Never imported from route/component modules directly — filename-guarded (*.server.ts).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_EMAIL = "Polytechnic Tutorial <noreply@polytechnictutorial.com>";

export type EbookLink = {
  title: string;
  downloadUrl: string;
};

export type EmailRenderInput = {
  orderNo: string;
  customerName: string;
  ebooks: EbookLink[];
};

export function renderEbookEmailHtml({ orderNo, customerName, ebooks }: EmailRenderInput): string {
  const rows = ebooks
    .map(
      (b) => `
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #eef1f4;font-family:Inter,system-ui,sans-serif;font-size:15px;color:#0f172a;">
            <div style="font-weight:600;margin-bottom:6px;">${escapeHtml(b.title)}</div>
            <a href="${b.downloadUrl}" style="display:inline-block;padding:9px 16px;background:#0f766e;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">
              ⬇ Download
            </a>
          </td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:32px 12px;background:#f6f8fa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
    <tr>
      <td style="padding:28px 24px;background:linear-gradient(135deg,#0f766e 0%,#0d9488 100%);color:#fff;font-family:Inter,system-ui,sans-serif;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">Polytechnic Tutorial</div>
        <div style="font-size:22px;font-weight:800;margin-top:6px;">আপনার ই-বুক প্রস্তুত!</div>
        <div style="font-size:13px;opacity:.9;margin-top:4px;">Order #${escapeHtml(orderNo)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 24px 6px;font-family:Inter,system-ui,sans-serif;font-size:15px;color:#0f172a;line-height:1.55;">
        <p style="margin:0 0 12px;">প্রিয় ${escapeHtml(customerName || "কাস্টমার")},</p>
        <p style="margin:0 0 8px;">আপনার অর্ডারের ই-বুক সমূহের ডাউনলোড লিংক নিচে দেয়া হলো। লিংকগুলো নিরাপদ জায়গায় সংরক্ষণ করুন।</p>
      </td>
    </tr>
    <tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0;">${rows}</table></td></tr>
    <tr>
      <td style="padding:8px 24px 24px;font-family:Inter,system-ui,sans-serif;font-size:12px;color:#64748b;line-height:1.6;">
        কোনো সমস্যায় support এ যোগাযোগ করুন। ধন্যবাদ! 🙏
      </td>
    </tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEbookEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    return { ok: false, error: "Resend connector not configured", status: 500 };
  }
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 500), status: res.status };
  }
  try {
    const json = JSON.parse(text) as { id?: string };
    if (!json.id) return { ok: false, error: "Resend response missing id", status: 502 };
    return { ok: true, id: json.id };
  } catch {
    return { ok: false, error: "Invalid Resend response", status: 502 };
  }
}

// Svix-style webhook signature verification used by Resend.
// Headers: svix-id, svix-timestamp, svix-signature ("v1,<base64>")
// HMAC = base64(HMAC_SHA256(`${id}.${timestamp}.${rawBody}`, secretBytes))
// Secret format: "whsec_<base64>"; we decode the base64 after the prefix.
export async function verifyResendSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const id = headers.get("svix-id") || headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") || headers.get("webhook-timestamp");
  const signatureHeader = headers.get("svix-signature") || headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const cleanSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64Decode(cleanSecret);
  } catch {
    return false;
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${timestamp}.${rawBody}`));
  const expected = base64Encode(new Uint8Array(sigBytes));

  // signatureHeader can contain multiple space-separated "v1,<sig>" values
  const parts = signatureHeader.split(" ");
  for (const p of parts) {
    const [version, sig] = p.split(",");
    if (version === "v1" && sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
