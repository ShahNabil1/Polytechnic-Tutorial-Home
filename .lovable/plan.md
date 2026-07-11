## লক্ষ্য (এই ধাপে শুধু এটুকু)

Steadfast এর পুরো API একটা **স্বাধীন Cloudflare Worker** এ বসানো। Lovable app (TanStack Start) সরাসরি Steadfast কে কল করবে না — সব কল যাবে Worker এ, Worker Steadfast কে কল করবে। Steadfast এর webhook ও Worker এ আসবে, Worker Supabase REST API দিয়ে সরাসরি `orders` টেবিলে স্ট্যাটাস আপডেট করবে।

কোনো bulk RTS, SMS, email, ebook, queue — এই ধাপে কিছুই না। শুধু Steadfast ↔ Worker ↔ Supabase পাইপ।

## আর্কিটেকচার

```text
                ┌───────────────────────────┐
   Admin UI ──▶ │  Lovable app (TanStack)   │
                │  server fn → fetch()      │
                └─────────────┬─────────────┘
                              │ HTTPS + HMAC header
                              ▼
                ┌───────────────────────────┐
                │  Cloudflare Worker        │
                │  (আপনার CF account)       │
                │  - /api/steadfast/*       │◀── Steadfast webhook
                │  - HMAC verify            │    (status update)
                └─────────────┬─────────────┘
                              │ Supabase REST (service_role)
                              ▼
                     Supabase (orders table)
```

**গুরুত্বপূর্ণ:** Lovable app কখনো `portal.packzy.com` কে সরাসরি call করবে না। সব কল Worker দিয়ে যাবে। এতে Steadfast API key শুধু Worker এ থাকবে, browser/Lovable env এ না।

## Worker এ থাকবে ৮টা endpoint (Steadfast এর সাথে ১-১ mapping)

| Path | Method | Steadfast এ কী করে |
|---|---|---|
| `/api/steadfast/create-order` | POST | Placing an order |
| `/api/steadfast/create-order-bulk` | POST | Bulk order create |
| `/api/steadfast/status/:key/:value` | GET | Delivery status (cid / invoice / tracking) |
| `/api/steadfast/balance` | GET | Current balance |
| `/api/steadfast/return/:id` | GET | Single return request |
| `/api/steadfast/returns` | GET | All return requests |
| `/api/steadfast/payments` | GET | Payments list |
| `/api/steadfast/payment/:id` | GET | Single payment + consignments |
| `/api/webhooks/steadfast` | POST | Steadfast → Worker status callback |

প্রথম ৮টা: Lovable → Worker কল, HMAC header দিয়ে verify।
শেষটা: Steadfast → Worker, Steadfast এর নিজস্ব secret দিয়ে verify (Steadfast dashboard এ webhook URL + secret set করবেন)।

## এক এক করে সেটাপ করলে সমস্যা আছে?

না, বরং এটাই সঠিক পথ। প্রস্তাবিত ৪ ধাপ, প্রতিটা আলাদা turn এ, আগেরটা কাজ করার পরই পরেরটা:

**Step 1 — Worker scaffold + Auth + Balance endpoint (সবচেয়ে ছোট)**
- `cloudflare-worker/` folder এ Hono based Worker (wrangler.toml সহ)
- Secrets: `STEADFAST_API_KEY`, `STEADFAST_SECRET_KEY`, `LOVABLE_HMAC_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STEADFAST_WEBHOOK_SECRET`
- HMAC middleware (Lovable → Worker verify)
- `/api/steadfast/balance` — সবচেয়ে সহজ কল, এটা দিয়ে end-to-end পাইপ যাচাই
- Lovable side: `src/lib/steadfast.functions.ts` এ `getSteadfastBalance()` server fn যা Worker এ fetch করে
- Admin UI তে ছোট "Check Balance" button

**Step 2 — Read endpoints (status, returns, payments)**
- ৬টা GET endpoint Worker এ যোগ (status, return single/list, payments list/single)
- Admin drawer এ একটা "Steadfast Info" panel — order এর consignment_id থাকলে live status দেখাবে

**Step 3 — Create order (single + bulk)**
- Worker এ 2টা POST endpoint
- Lovable side এ `pushOrderToSteadfast(orderId)` server fn (এখনো bulk/auto না, শুধু ম্যানুয়াল একটা button drawer এ)
- সফল হলে Worker Supabase কে সরাসরি update দেবে: `steadfast_consignment_id`, `steadfast_tracking_code`, `steadfast_synced_at`

**Step 4 — Steadfast webhook receiver**
- `/api/webhooks/steadfast` — Steadfast থেকে status update এলে Worker সরাসরি Supabase `orders.steadfast_status` update করে, সাথে `order_status_history` তে entry
- Lovable এ realtime subscription আগে থেকেই আছে, তাই UI নিজে থেকেই refresh হবে

প্রতিটা step এর শেষে আপনি test করে বলবেন "ok পরেরটায় যাও"।

## Testing কীভাবে হবে (এটাই বড় প্রশ্ন)

Worker Lovable preview এ host করা যাবে না। দুইভাবে test:

1. **Local:** আপনার মেশিনে `wrangler dev` → `http://localhost:8787`। Lovable preview এর `.env.local` এ `VITE_STEADFAST_WORKER_URL=http://localhost:8787` দিলে preview থেকে ওখানে কল যাবে। শুধু Steadfast webhook local এ পাবে না (Steadfast public URL দরকার)।
2. **Deployed:** `wrangler deploy` → `https://pth-steadfast.<your-subdomain>.workers.dev`। এই URL Lovable এর secret এ বসাবো (`STEADFAST_WORKER_URL`), Steadfast dashboard এও webhook হিসেবে বসাবেন।

আমি সব code, wrangler config, deploy instruction, curl test command রেডি করে দেবো। আপনাকে শুধু নিজের CF account এ একবার `wrangler login` + `wrangler deploy` চালাতে হবে।

## এই ধাপে যা কিছু **করা হবে না**

- Bulk RTS button, ebook guard, SMS, email, Resend, D1, KV, Queues — কিছুই না
- Cron / auto-status-poll — না
- `order_status_history` এ webhook entry ছাড়া অন্য কোনো নতুন migration — না

শুধু Steadfast এর পাইপ সম্পূর্ণ কাজ করবে এবং drawer থেকে ম্যানুয়ালি push/check করা যাবে।

## আপনার কাছে যা লাগবে (Step 1 শুরুর আগে)

1. Steadfast `Api-Key` এবং `Secret-Key`
2. Cloudflare account (free tier যথেষ্ট) + `wrangler` CLI বসানো
3. Steadfast dashboard এ webhook URL বসানোর অ্যাক্সেস (Step 4 এ লাগবে)

তৈরি থাকলে বলুন — Step 1 এর জন্য approve দিলে Worker scaffold + balance endpoint দিয়ে শুরু করবো।