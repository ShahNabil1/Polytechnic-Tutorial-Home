import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyLovableHmac } from "./hmac";
import {
  createOrder,
  createOrderBulk,
  getBalance,
  getStatusByCid,
  type SteadfastCreatePayload,
  type SteadfastEnv,
} from "./steadfast";
import { appendStatusHistory, updateOrder, type SupabaseEnv } from "./supabase";

// ---------- Bindings ----------
type Bindings = SteadfastEnv &
  SupabaseEnv & {
    STEADFAST_WORKER_HMAC_SECRET: string;
    STEADFAST_WEBHOOK_SECRET: string;
    ALLOWED_ORIGINS: string;
    STEADFAST_QUEUE: Queue<QueueJob>;
  };

// ---------- Queue message shapes ----------
export type QueueJob =
  | {
      type: "create_order";
      order_id: string; // public.orders.id
      order_no: string; // for logging / correlation
      payload: SteadfastCreatePayload;
      enqueued_at: number;
    }
  | {
      // Optional "aggregate" bulk job. The producer may instead enqueue N
      // individual create_order jobs; the consumer handles both.
      type: "create_order_bulk";
      orders: Array<{ order_id: string; order_no: string; payload: SteadfastCreatePayload }>;
      enqueued_at: number;
    };

// =====================================================================
// FETCH HANDLER (HTTP)
// =====================================================================
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : allowed[0] ?? ""),
    allowHeaders: ["content-type", "x-lovable-timestamp", "x-lovable-signature"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 600,
  })(c, next);
});

app.get("/", (c) => c.json({ ok: true, service: "pth-steadfast", ts: Date.now() }));

/** HMAC verification for every /api/steadfast/* route. */
app.use("/api/steadfast/*", async (c, next) => {
  const rawBody = c.req.method === "GET" || c.req.method === "HEAD" ? "" : await c.req.text();
  if (rawBody) {
    c.req.raw = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
      body: rawBody,
    });
  }
  const url = new URL(c.req.url);
  const result = await verifyLovableHmac({
    secret: c.env.STEADFAST_WORKER_HMAC_SECRET,
    method: c.req.method,
    path: url.pathname,
    rawBody,
    timestampHeader: c.req.header("x-lovable-timestamp") ?? null,
    signatureHeader: c.req.header("x-lovable-signature") ?? null,
  });
  if (!result.ok) return c.json({ error: "unauthorized", reason: result.reason }, 401);
  await next();
});

// ---------- Balance (sync, Step 1) ----------
app.get("/api/steadfast/balance", async (c) => {
  const { status, body } = await getBalance(c.env);
  return c.json({ upstream_status: status, data: body }, status === 200 ? 200 : 502);
});

// ---------- Delivery status by consignment id (sync read) ----------
app.get("/api/steadfast/status/cid/:cid", async (c) => {
  const { status, body } = await getStatusByCid(c.env, c.req.param("cid"));
  return c.json({ upstream_status: status, data: body }, status === 200 ? 200 : 502);
});

// ---------- CREATE ORDER (single) — ENQUEUE ONLY ----------
// Body: { order_id, order_no, payload: SteadfastCreatePayload }
app.post("/api/steadfast/create-order", async (c) => {
  let body: {
    order_id?: string;
    order_no?: string;
    payload?: SteadfastCreatePayload;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const err = validateJob(body);
  if (err) return c.json({ error: "invalid_payload", detail: err }, 400);

  const job: QueueJob = {
    type: "create_order",
    order_id: body.order_id!,
    order_no: body.order_no!,
    payload: body.payload!,
    enqueued_at: Date.now(),
  };
  await c.env.STEADFAST_QUEUE.send(job);
  return c.json({ ok: true, queued: 1, order_id: job.order_id }, 202);
});

// ---------- CREATE ORDER (bulk) — ENQUEUE N ----------
// Body: { orders: [{ order_id, order_no, payload }] }
app.post("/api/steadfast/create-order-bulk", async (c) => {
  let body: {
    orders?: Array<{ order_id?: string; order_no?: string; payload?: SteadfastCreatePayload }>;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const orders = body.orders;
  if (!Array.isArray(orders) || orders.length === 0) {
    return c.json({ error: "invalid_payload", detail: "orders[] required" }, 400);
  }
  if (orders.length > 500) {
    return c.json({ error: "too_many", detail: "max 500 per request" }, 400);
  }

  const errors: Array<{ index: number; detail: string }> = [];
  const messages: { body: QueueJob }[] = [];
  orders.forEach((o, i) => {
    const detail = validateJob(o);
    if (detail) {
      errors.push({ index: i, detail });
      return;
    }
    messages.push({
      body: {
        type: "create_order",
        order_id: o.order_id!,
        order_no: o.order_no!,
        payload: o.payload!,
        enqueued_at: Date.now(),
      },
    });
  });

  if (errors.length) return c.json({ error: "invalid_payload", errors }, 400);

  // sendBatch supports up to 100 messages per call → chunk if needed.
  const CHUNK = 100;
  for (let i = 0; i < messages.length; i += CHUNK) {
    await c.env.STEADFAST_QUEUE.sendBatch(messages.slice(i, i + CHUNK));
  }
  return c.json({ ok: true, queued: messages.length }, 202);
});

// ---------- Webhook placeholder (Step 4) ----------
app.post("/api/webhooks/steadfast", (c) => c.json({ ok: true, note: "wired in Step 4" }));

app.notFound((c) => c.json({ error: "not_found", path: new URL(c.req.url).pathname }, 404));
app.onError((err, c) => {
  console.error("worker error:", err);
  return c.json({ error: "internal", message: err.message }, 500);
});

function validateJob(o: {
  order_id?: string;
  order_no?: string;
  payload?: SteadfastCreatePayload;
}): string | null {
  if (!o?.order_id) return "order_id required";
  if (!o.order_no) return "order_no required";
  const p = o.payload;
  if (!p) return "payload required";
  if (!p.invoice) return "payload.invoice required";
  if (!p.recipient_name) return "payload.recipient_name required";
  if (!p.recipient_phone || !/^\d{11}$/.test(p.recipient_phone))
    return "payload.recipient_phone must be 11 digits";
  if (!p.recipient_address) return "payload.recipient_address required";
  if (typeof p.cod_amount !== "number" || p.cod_amount < 0) return "payload.cod_amount required";
  return null;
}

// =====================================================================
// QUEUE CONSUMER
// =====================================================================
async function handleQueueMessage(msg: Message<QueueJob>, env: Bindings): Promise<void> {
  const job = msg.body;

  if (job.type === "create_order_bulk") {
    // Fan out an aggregate bulk job to per-order messages.
    const batch = job.orders.map((o) => ({
      body: {
        type: "create_order" as const,
        order_id: o.order_id,
        order_no: o.order_no,
        payload: o.payload,
        enqueued_at: Date.now(),
      },
    }));
    for (let i = 0; i < batch.length; i += 100) {
      await env.STEADFAST_QUEUE.sendBatch(batch.slice(i, i + 100));
    }
    msg.ack();
    return;
  }

  // type === "create_order"
  const { status, body } = await createOrder(env, job.payload);
  const parsed = body as {
    status?: number;
    message?: string;
    consignment?: {
      consignment_id?: number | string;
      tracking_code?: string;
      status?: string;
    };
  } | null;

  if (status === 200 && parsed?.consignment?.consignment_id) {
    const cons = parsed.consignment;
    const patch = {
      status: "ready_to_ship",
      steadfast_consignment_id: String(cons.consignment_id),
      steadfast_tracking_code: cons.tracking_code ?? null,
      steadfast_status: cons.status ?? "in_review",
      steadfast_synced_at: new Date().toISOString(),
    };
    const upd = await updateOrder(env, job.order_id, patch);
    if (!upd.ok) {
      console.error("supabase update failed", job.order_no, upd.status, upd.body);
      msg.retry({ delaySeconds: 30 });
      return;
    }
    await appendStatusHistory(env, {
      order_id: job.order_id,
      to_status: "ready_to_ship",
      note: `Steadfast consignment ${cons.consignment_id} · ${cons.tracking_code ?? ""}`.trim(),
    });
    msg.ack();
    return;
  }

  // Failure — retry with backoff. Cloudflare enforces max_retries; the DLQ
  // catches anything that exhausts retries.
  console.error(
    "steadfast create_order failed",
    job.order_no,
    "http",
    status,
    "body",
    parsed?.message ?? body,
  );
  const attempt = msg.attempts ?? 1;
  const delay = Math.min(60 * Math.pow(2, attempt - 1), 900); // 60s → 15m cap
  msg.retry({ delaySeconds: delay });
}

// =====================================================================
// EXPORTS
// =====================================================================
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<QueueJob>, env: Bindings): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await handleQueueMessage(msg, env);
      } catch (err) {
        console.error("queue handler threw", err);
        const attempt = msg.attempts ?? 1;
        const delay = Math.min(60 * Math.pow(2, attempt - 1), 900);
        msg.retry({ delaySeconds: delay });
      }
    }
  },
} satisfies ExportedHandler<Bindings, QueueJob>;
