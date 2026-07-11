// Supabase Auth "Send SMS" hook — sends OTP via bulksmsbd.net
// Configure in Supabase Dashboard: Authentication → Hooks → Send SMS hook

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BULKSMSBD_API_KEY = Deno.env.get("BULKSMSBD_API_KEY")!;
const BULKSMSBD_SENDER_ID = Deno.env.get("BULKSMSBD_SENDER_ID")!;
const HOOK_SECRET = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface SmsHookPayload {
  user: { id: string; phone: string };
  sms: { otp: string; sms_type?: string };
}

function normalize(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  return "88" + digits;
}

async function lookupName(userId: string): Promise<string> {
  try {
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const name = (data?.full_name || "").trim();
    return name;
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();

  try {
    const wh = new Webhook(HOOK_SECRET);
    wh.verify(rawBody, Object.fromEntries(req.headers));
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  let payload: SmsHookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const phone = normalize(payload.user.phone);
  const otp = payload.sms.otp;
  const name = await lookupName(payload.user.id);

  // Determine template key from sms_type. Supabase sends: recovery (password reset),
  // signup, invite, magiclink, etc. Map to our template keys.
  const smsType = String(payload.sms.sms_type ?? "").toLowerCase();
  const templateKey = smsType === "recovery" || smsType === "reauthentication"
    ? "reset_otp"
    : "signup_otp";

  let message = "";
  try {
    const { data: tpl } = await admin
      .from("sms_templates")
      .select("body")
      .eq("key", templateKey)
      .maybeSingle();
    if (tpl?.body) {
      message = String(tpl.body)
        .replace(/\{\{\s*newline\s*\}\}/gi, "\n")
        .replace(/\{\{\s*name\s*\}\}/gi, name || "গ্রাহক")
        .replace(/\{\{\s*otp\s*\}\}/gi, otp);
    }
  } catch (e) {
    console.error("template lookup failed:", e);
  }
  if (!message) {
    const greeting = name ? `প্রিয় ${name},\n\n` : "";
    message =
      `${greeting}আপনার Polytechnic Tutorial Home OTP কোড: ${otp}\n\n` +
      `কোডটি ৫ মিনিটের জন্য বৈধ। কারো সাথে শেয়ার করবেন না।`;
  }

  // Bulksmsbd needs type=unicode for non-ASCII (Bengali); "text" is accepted
  // but silently dropped by carriers.
  const isUnicode = /[^\x00-\x7F]/.test(message);
  const url = new URL("http://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", BULKSMSBD_API_KEY);
  url.searchParams.set("type", isUnicode ? "unicode" : "text");
  url.searchParams.set("number", phone);
  url.searchParams.set("senderid", BULKSMSBD_SENDER_ID);
  url.searchParams.set("message", message);

  const smsRes = await fetch(url.toString());
  const text = await smsRes.text();
  console.log("bulksmsbd response:", smsRes.status, text);

  let ok = smsRes.ok;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.response_code && parsed.response_code !== 202) ok = false;
  } catch { /* text response */ }

  if (!ok) {
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: `bulksmsbd failed: ${text}` } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
