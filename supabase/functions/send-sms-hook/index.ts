// Supabase Auth "Send SMS" hook — sends OTP via bulksmsbd.net
// Configure in Supabase Dashboard: Authentication → Hooks → Send SMS hook
// URL: https://<project-ref>.supabase.co/functions/v1/send-sms-hook
// Secret: SEND_SMS_HOOK_SECRET (v1,whsec_...)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const BULKSMSBD_API_KEY = Deno.env.get("BULKSMSBD_API_KEY")!;
const BULKSMSBD_SENDER_ID = Deno.env.get("BULKSMSBD_SENDER_ID")!;
const HOOK_SECRET = (Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "").replace("v1,whsec_", "");

interface SmsHookPayload {
  user: { id: string; phone: string };
  sms: { otp: string; sms_type?: string };
}

function normalize(phone: string): string {
  // bulksmsbd expects 8801XXXXXXXXX (no +)
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  return "88" + digits;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();

  // Verify signature (Supabase Auth Hook uses Standard Webhooks)
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
  const message = `আপনার Polytechnic Tutorial Home OTP কোড: ${otp}\n\nকোডটি ৫ মিনিটের জন্য বৈধ। কারো সাথে শেয়ার করবেন না।`;

  const url = new URL("http://bulksmsbd.net/api/smsapi");
  url.searchParams.set("api_key", BULKSMSBD_API_KEY);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", phone);
  url.searchParams.set("senderid", BULKSMSBD_SENDER_ID);
  url.searchParams.set("message", message);

  const smsRes = await fetch(url.toString());
  const text = await smsRes.text();
  console.log("bulksmsbd response:", smsRes.status, text);

  // bulksmsbd returns JSON like {"response_code":202,"message_id":...} on success
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
