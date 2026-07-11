import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyLovableHmac } from "./hmac";
import { getBalance, type SteadfastEnv } from "./steadfast";

type Bindings = SteadfastEnv & {
  LOVABLE_HMAC_SECRET: string;
  STEADFAST_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : allowed[0] ?? ""),
    allowHeaders: ["content-type", "x-lovable-timestamp", "x-lovable-signature"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
  })(c, next);
});

app.get("/", (c) => c.json({ ok: true, service: "pth-steadfast", ts: Date.now() }));

/**
 * Middleware: verify Lovable HMAC on every /api/steadfast/* call.
 */
app.use("/api/steadfast/*", async (c, next) => {
  const rawBody = c.req.method === "GET" || c.req.method === "HEAD" ? "" : await c.req.text();
  // Re-attach body so downstream handlers can read it.
  if (rawBody) {
    c.req.raw = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
      body: rawBody,
    });
  }
  const url = new URL(c.req.url);
  const result = await verifyLovableHmac({
    secret: c.env.LOVABLE_HMAC_SECRET,
    method: c.req.method,
    path: url.pathname,
    rawBody,
    timestampHeader: c.req.header("x-lovable-timestamp") ?? null,
    signatureHeader: c.req.header("x-lovable-signature") ?? null,
  });
  if (!result.ok) return c.json({ error: "unauthorized", reason: result.reason }, 401);
  await next();
});

// -------------- Step 1: balance --------------
app.get("/api/steadfast/balance", async (c) => {
  const { status, body } = await getBalance(c.env);
  return c.json({ upstream_status: status, data: body }, status === 200 ? 200 : 502);
});

// -------------- Webhook placeholder (Step 4) --------------
app.post("/api/webhooks/steadfast", (c) => c.json({ ok: true, note: "wired in Step 4" }));

app.notFound((c) => c.json({ error: "not_found", path: new URL(c.req.url).pathname }, 404));
app.onError((err, c) => {
  console.error("worker error:", err);
  return c.json({ error: "internal", message: err.message }, 500);
});

export default app;
