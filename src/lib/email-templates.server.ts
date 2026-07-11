/**
 * Email template rendering helpers. Server-only.
 */

export function renderEmailTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  let out = body ?? "";
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(
      `\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
      "gi",
    );
    out = out.replace(re, val == null ? "" : String(val));
  }
  return out;
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEbookListHtml(ebooks: Array<{ title: string; downloadUrl: string }>): string {
  const rows = ebooks
    .map(
      (b) => `
        <div style="padding:14px 0;border-bottom:1px solid #eef1f4;">
          <div style="font-weight:600;margin-bottom:6px;color:#0f172a;">${escapeHtml(b.title)}</div>
          <a href="${b.downloadUrl}" style="display:inline-block;padding:9px 16px;background:#0f766e;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">
            ⬇ Download
          </a>
        </div>`,
    )
    .join("");
  return `<div>${rows}</div>`;
}
