# PTH Steadfast Worker — Cloudflare Dashboard দিয়ে সেটআপ

লোকাল CLI / wrangler লাগবে না। সব Cloudflare dashboard থেকেই। নিচের ধাপগুলো ক্রমান্বয়ে করুন।

Repo তে যে ৪টা ফাইল আছে (dashboard এ paste করবেন):
- `cloudflare-worker/src/index.ts`
- `cloudflare-worker/src/hmac.ts`
- `cloudflare-worker/src/steadfast.ts`
- `cloudflare-worker/src/supabase.ts`

Dashboard এর built-in editor multi-file support করে (Hono import সহ কাজ করার জন্য এই ৪টা ফাইলই আলাদা tab এ রাখতে হবে)।

---

## Step 1 — Queue দুটো বানান

1. Cloudflare Dashboard → বাম sidebar → **Workers & Pages** → **Queues** → **Create queue**
2. Name: `steadfast-jobs` → **Create queue**
3. আবার **Create queue** → Name: `steadfast-jobs-dlq` → **Create queue**

দুটোই বানানো শেষে Queues list এ দুটো নাম দেখা যাবে।

> Queues এর জন্য Workers Paid plan ($5/mo) লাগে। Free plan এ Queue create option আসবে না।

---

## Step 2 — Worker বানান

1. **Workers & Pages** → **Create** → **Workers** tab → **Create Worker**
2. Name: `pth-steadfast` → **Deploy** (এখন default "Hello World" deploy হবে, ঠিক আছে)
3. Deploy হওয়ার পরে **Edit code** button click করুন — dashboard editor খুলবে

---

## Step 3 — Code paste করুন

Editor এ বামের file tree তে:

1. **`worker.js`** default file আছে → এটাকে rename করে `src/index.ts` (right-click → rename)
2. **Add file** button দিয়ে আরও ৩টা file বানান:
   - `src/hmac.ts`
   - `src/steadfast.ts`
   - `src/supabase.ts`
3. প্রতিটা ফাইলে repo এর সাথে থাকা corresponding file এর content **হুবহু copy-paste** করুন
4. Editor এর top-right এ **package.json** tab → Hono add করুন:

```json
{
  "name": "pth-steadfast",
  "main": "src/index.ts",
  "compatibility_date": "2024-11-27",
  "compatibility_flags": ["nodejs_compat"],
  "dependencies": {
    "hono": "^4.6.14"
  }
}
```

> Dashboard editor `main` ফিল্ড দেখে entry file resolve করে। `src/index.ts` না দিলে "Module not found" হবে।

5. উপরে **Save and deploy** click করুন। এখন Worker basic ভাবে চলছে (কিন্তু secrets/queue bindings এখনো নেই, তাই request গুলো fail করবে — পরের steps এ ঠিক হবে)।

---

## Step 4 — Compatibility & Queue bindings

Dashboard editor থেকে **←** back → Worker এর overview page → **Settings** tab।

### 4a. Compatibility

**Settings → Build → Runtime**
- Compatibility date: `2024-11-27`
- Compatibility flags: `nodejs_compat` যোগ করুন
- **Save**

### 4b. Queue producer binding (Worker → Queue এ push)

**Settings → Bindings → Add → Queue Producer**
- Variable name: `STEADFAST_QUEUE`
- Queue: `steadfast-jobs` (dropdown থেকে select)
- **Deploy**

### 4c. Queue consumer (Queue → Worker কল করে)

এইটা Worker settings এ না, **Queue এর settings এ** যোগ করতে হয়:

1. **Workers & Pages → Queues → `steadfast-jobs`** click
2. **Consumers** tab → **Add consumer** → **Worker**
3. Worker: `pth-steadfast` select করুন
4. Settings:
   - Max batch size: `10`
   - Max batch timeout: `5` seconds
   - Max retries: `5`
   - Max concurrency: `4`
   - Dead letter queue: `steadfast-jobs-dlq`
5. **Add consumer**

এখন `steadfast-jobs` queue এ যেকোনো message এলে Worker এর `queue()` handler automatic call হবে।

---

## Step 5 — Secrets বসান (৬টা)

Worker page → **Settings → Variables and Secrets → Add**

প্রতিটার জন্য **Type = Secret** (Text না) সিলেক্ট করে value বসান:

| Name | Value কোথা থেকে |
|---|---|
| `STEADFAST_API_KEY` | Steadfast dashboard → API Credentials |
| `STEADFAST_SECRET_KEY` | Steadfast dashboard → API Credentials |
| `STEADFAST_WORKER_HMAC_SECRET` | Lovable প্রজেক্টের `STEADFAST_WORKER_HMAC_SECRET` secret এর হুবহু value (নিচে দেখানো আছে কীভাবে পাবেন) |
| `SUPABASE_URL` | `https://qmqcfzgbkzdedfqrmoah.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` key |
| `STEADFAST_WEBHOOK_SECRET` | আপনি নিজে বানাবেন — যেকোনো ৩২+ char random string (Step 8 এ Steadfast dashboard এও একই value বসাতে হবে) |

সাথে ২টা **Type = Text (plain)** environment variable ও যোগ করুন:

| Name | Value |
|---|---|
| `STEADFAST_BASE_URL` | `https://portal.packzy.com/api/v1` |
| `ALLOWED_ORIGINS` | `https://polytechnictutorial.com,https://www.polytechnictutorial.com,https://polyverse-learn-shop.lovable.app` |

### STEADFAST_WORKER_HMAC_SECRET কীভাবে পাবেন

Lovable chat এ Cloudflare dashboard access নেই, তাই secret এর plain value আমি দেখতে পাই না। আপনি নিজে দেখবেন এভাবে:

- এই chat এ বলুন "STEADFAST_WORKER_HMAC_SECRET reveal" — আমি secret reveal tool call করবো, আপনি একবার copy করে Cloudflare এ paste করবেন।
- অথবা আপনি নিজেই ৬৪-char random string বানিয়ে **দুই জায়গাতেই** সেই value বসাবেন (Cloudflare secret + Lovable secret `update` — বললে আমি update-form খুলে দেবো)।

দুই side এ একই value থাকতেই হবে, নইলে সব call `401 signature mismatch` দেবে।

**Save and deploy** সব secret বসানোর পর।

---

## Step 6 — Deploy verify

Worker overview → উপরে দেখানো URL, যেমন:

```
https://pth-steadfast.<your-subdomain>.workers.dev
```

Browser এ ওই URL খুলুন — `{"ok":true,"service":"pth-steadfast",...}` দেখতে হবে।

এই URL কপি করে Lovable এ পাঠান — আমি `STEADFAST_WORKER_URL` secret এ বসিয়ে দেবো। তারপর ecommerce dashboard এর "Check Balance" button থেকে end-to-end test হবে।

---

## Step 7 — Live logs দেখা

Worker page → **Logs** tab → **Begin log stream**। এখানে real-time request/queue log আসবে (`console.log`, error stack সব)।

Queue এর নিজস্ব stats: **Queues → steadfast-jobs → Messages** — কতগুলো enqueued, ack, retry, dead-lettered — সব দেখা যাবে।

---

## Step 8 — Steadfast webhook (Step 4 এর সাথে করব)

এখন wire করা লাগবে না, শুধু জেনে রাখুন কোথায় বসাবেন:

1. Steadfast dashboard → Settings → Webhooks (বা Notification)
2. **URL**: `https://pth-steadfast.<subdomain>.workers.dev/api/webhooks/steadfast`
3. **Secret / signing key**: Step 5 এ যেই `STEADFAST_WEBHOOK_SECRET` বসিয়েছেন সেই একই value
4. Events: order status update (delivered, hold, returned, cancelled — সব চেক)

`/api/webhooks/steadfast` handler এখন placeholder — Step 4 এ signature verify + Supabase update wire করবো।

---

## যা এই ধাপে থাকল **না**

- CLI / wrangler কিছু লাগবে না
- Local dev environment লাগবে না
- বাকি endpoint (`/status/*`, `/returns/*`, `/payments/*`) — Step 2
- Webhook real handler — Step 4

সব ঠিক থাকলে dashboard এ ৭-১০ মিনিটে সেটআপ শেষ। কোন step এ আটকে গেলে বলুন।
