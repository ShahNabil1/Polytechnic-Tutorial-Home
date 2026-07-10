/**
 * Server-only helpers for session tracking + 2-device enforcement.
 *
 * Captures a real device fingerprint at the edge:
 * - IP (Cloudflare CF-Connecting-IP → X-Real-IP → first X-Forwarded-For)
 * - Geo (CF-IPCountry / CF-Region / CF-IPCity / CF-Timezone / CF-IPLatitude /
 *   CF-IPLongitude, populated by Cloudflare on every request)
 * - Device (browser / OS / device type parsed from User-Agent)
 */
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";

export type ParsedUA = {
  label: string;
  browser: string;
  os: string;
  device_type: "mobile" | "tablet" | "desktop";
};

export function parseUserAgent(ua: string): ParsedUA {
  if (!ua) {
    return { label: "Unknown device", browser: "Unknown", os: "Unknown", device_type: "desktop" };
  }

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

  let device_type: ParsedUA["device_type"] = "desktop";
  if (/iPad|Tablet/i.test(ua)) device_type = "tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device_type = "mobile";

  return { label: `${browser} · ${os}`, browser, os, device_type };
}

export function getClientIp(): string {
  const req = getRequest();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf;
  const real = getRequestHeader("x-real-ip");
  if (real) return real;
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  try {
    return new URL(req.url).hostname;
  } catch {
    return "unknown";
  }
}

export function getClientUserAgent(): string {
  return getRequestHeader("user-agent") || "";
}

export type ClientGeo = {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

function numOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Read Cloudflare geo headers set on every edge request. */
export function getClientGeo(): ClientGeo {
  return {
    country: getRequestHeader("cf-ipcountry") || null,
    region: getRequestHeader("cf-region") || null,
    city: getRequestHeader("cf-ipcity") || null,
    timezone: getRequestHeader("cf-timezone") || null,
    latitude: numOrNull(getRequestHeader("cf-iplatitude")),
    longitude: numOrNull(getRequestHeader("cf-iplongitude")),
  };
}
