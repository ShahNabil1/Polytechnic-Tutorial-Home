/**
 * Server-only helpers for session tracking + 2-device enforcement.
 */
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

export function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown device";
  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg|OPR/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} · ${os}`;
}

export function getClientIp(): string {
  const req = getRequest();
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  const real = getRequestHeader("x-real-ip");
  if (real) return real;
  try {
    return new URL(req.url).hostname;
  } catch {
    return "unknown";
  }
}

export function getClientUserAgent(): string {
  return getRequestHeader("user-agent") || "";
}
