# Ebook Auto-Delivery + Resend Webhook Integration

## গোল

Processing এ আসা অর্ডারের ই-বুক অংশ Resend দিয়ে অটো ডেলিভার হবে। ফিজিক্যাল অংশ আগের RTS/Steadfast ফ্লোতেই চলবে। মিক্সড অর্ডারে দুই পার্ট আলাদাভাবে ট্র্যাক হবে, কিন্তু অর্ডার আইডি এক থাকবে।

---

## Core ধারণা: Fulfillment Split

একটা `orders` রো তে এখন একটাই `status` — এইটা সব ক্ষেত্রে যথেষ্ট না। তাই দুইটা নতুন সাব-স্ট্যাটাস যোগ করব:

- `digital_status` — `not_applicable | pending | queued | sent | delivered | bounced | failed | delayed | manual_review`
- `physical_status` — `not_applicable | pending | ready_to_ship | shipped | delivered | returned | hold` (মূলত আগের flow-ই, আলাদা কলামে)

Order-level `status` এখন derived:
- Digital-only: `digital_status` → order status
- Physical-only: `physical_status` → order status
- Mixed: `delivered` তখনই যখন দুইটাই delivered। যেকোনো একটা delivered হলে UI তে partial badge দেখাবে (e.g. "ই-বুক ডেলিভারড • ফিজিক্যাল শিপড")

এতে ফিজিক্যাল flow break হয় না, ই-বুক flow স্বাধীন।

---

## ডাটা মডেল

নতুন টেবিল **`order_email_deliveries`** — এক অর্ডারের প্রতিটা ই-মেইল অ্যাটেম্পটের ট্রেইল:

- `order_id`, `attempt_no` (১, ২, ৩…), `resend_email_id`, `to_email`
- `status` (`queued | sent | delivered | bounced | delayed | failed | opened | clicked`)
- `error_reason`, `bounce_type`, `provider_payload jsonb`
- `sent_at`, `delivered_at`, `next_retry_at`, timestamps

`orders` এ নতুন কলাম:
- `digital_status`, `physical_status`
- `digital_delivered_at`, `digital_locked_until` (view lock timer)
- `digital_last_error`

`ebook_assets` (নতুন, বা `products` এ কলাম) — প্রতি ই-বুকের জন্য signed download URL generator তথ্য: `storage_key`, `bucket`, `expires_in_seconds`।

---

## ফ্লো

### 1. Payment verified → Processing
`orders.status = 'processing'` এবং:
- যদি অর্ডারে ই-বুক থাকে: `digital_status = 'pending'`, `digital_locked_until = now() + 2 min` (View drawer এই সময় locked থাকবে যাতে duplicate trigger না হয়)
- ফিজিক্যাল থাকলে: `physical_status = 'pending'`

DB trigger বা Processing transition এ **pg_net** দিয়ে Supabase Edge Function `deliver-ebook-order` কল হবে (রিসেন্ড কল edge function এ, TanStack server function এ না — ব্যাচ/queue/retry এর জন্য edge function বেটার আর ইউজার নিজেই edge function চেয়েছে)।

### 2. Edge Function `deliver-ebook-order`
Input: `order_id`

কাজ:
1. Order + items লোড, শুধু ই-বুক items ফিল্টার
2. প্রতিটা ই-বুকের জন্য signed download URL জেনারেট (R2/Supabase Storage, expires ৭ দিন)
3. **একটাই ইমেইল** — সব লিংক এক টেমপ্লেটে (list layout: বইয়ের নাম + Download বাটন)
4. Resend API কল (কানেক্টর gateway দিয়ে, `noreply@polytechnictutorial.com` from)
5. `order_email_deliveries` এ `resend_email_id` সহ `sent` রো ইনসার্ট
6. Resend ২০০ OK → `orders.digital_status = 'sent'`, `digital_locked_until` ক্লিয়ার
7. Non-2xx → `digital_status = 'failed'`, `digital_last_error` সেট, retry scheduled

**Queue/Chunking:** একই সাথে অনেক অর্ডার আসলে edge function কে ব্যাচে চালানোর জন্য একটা সিম্পল pattern — pg_cron প্রতি ১ মিনিটে `digital_status IN ('pending','failed')` AND `next_retry_at <= now()` রো গুলা ১০-১৫ টা করে পিক করে edge function কে কল করবে। এক-শট পাথ (payment→processing) আর retry পাথ — দুইটাই same function।

### 3. Resend Webhook
`/api/public/webhooks/resend` — TanStack server route (public prefix, signature verify করব `svix` HMAC দিয়ে যা Resend ব্যবহার করে; secret `RESEND_WEBHOOK_SECRET` add করব)।

Events → action:
- `email.sent` → `order_email_deliveries.status = 'sent'`
- `email.delivered` → delivery row + `orders.digital_status = 'delivered'`, `digital_delivered_at = now()`, তারপর order-level status recompute (নিচে)
- `email.opened`, `email.clicked` → শুধু log/timestamp
- `email.delivery_delayed` → `status = 'delayed'`, reason store, order stays in processing
- `email.bounced` → `status = 'bounced'`, `bounce_type` (hard/soft), `digital_status = 'bounced'`, retry schedule (soft হলে)
- `email.failed` → `status = 'failed'`, `digital_status = 'failed'`, reason store
- `email.scheduled` → informational

### 4. Order-level Status Recompute
একটা DB function `recompute_order_status(order_id)`:

```
digital = orders.digital_status
physical = orders.physical_status

IF digital = 'not_applicable' → status = physical
IF physical = 'not_applicable' → status = map(digital)
IF both applicable:
  IF digital = 'delivered' AND physical = 'delivered' → 'delivered'
  ELSE → 'processing' (কিন্তু UI তে দুই পার্টের badge আলাদা)
```

এতে মিক্সড অর্ডারে ই-বুক ডেলিভারড হয়ে গেলেও অর্ডার processing/shipped এই থাকবে যতক্ষণ না Steadfast delivered কনফার্ম করে।

### 5. Retry Cron
pg_cron job প্রতি ৩০ মিনিটে:
- `digital_status IN ('sent','failed','bounced','delayed')` AND `digital_delivered_at IS NULL` AND `attempt_no < 3` AND `sent_at < now() - 30 min`
- Edge function কে আবার কল করে (নতুন `attempt_no` সহ)
- ৩য় অ্যাটেম্পটেও fail হলে `digital_status = 'manual_review'` — অর্ডার processing এই থাকবে, admin এর জন্য UI তে red badge + "Retry" / "Send manually" বাটন।

### 6. UI (Orders list + View drawer)

Order card এ:
- ই-বুক থাকলে ছোট badge: 🕐 Sent / ✅ Delivered / ⚠️ Bounced (reason tooltip) / 🔴 Manual review
- Mixed order: দুইটা badge পাশাপাশি (digital + physical)
- Processing এ থাকা অবস্থায় ই-বুক pending হলে View drawer এ open হবে কিন্তু "Sending emails… locked for 2 min" নোটিস + edit disabled (`digital_locked_until` চেক)

View drawer এ নতুন section **"Email Delivery"**:
- প্রতিটা attempt এর timeline: sent → delivered/bounced/opened/clicked, timestamps, error reason
- Manual "Resend email" বাটন (manual_review হলে বা যেকোনো সময় admin এর জন্য)

---

## Resend Setup

- Connector সেটাপ আছে — `RESEND_API_KEY` already available via gateway
- নতুন secret দরকার: `RESEND_WEBHOOK_SECRET` (Resend dashboard এ webhook তৈরি করলে যেই signing secret দেয়) — `add_secret` দিয়ে চাইব
- Webhook URL Resend এ configure করতে হবে: `https://polytechnictutorial.com/api/public/webhooks/resend` (stable URL) — সব ৮টা event subscribe

---

## টেকনিক্যাল সামারি

**Migrations:**
1. `orders` এ digital_status, physical_status, digital_delivered_at, digital_locked_until, digital_last_error কলাম
2. `order_email_deliveries` টেবিল + RLS + GRANTs
3. `recompute_order_status(order_id)` SQL function
4. Trigger: order status → processing হলে pg_net দিয়ে edge function কল
5. pg_cron: retry job (৩০ min interval)

**Edge function:** `deliver-ebook-order` — Resend gateway call, batch support

**Server route:** `/api/public/webhooks/resend` — signature verify + event handler

**Frontend:**
- Orders list card: digital/physical badge
- AdminOrderDrawer: lock during `digital_locked_until`, Email Delivery timeline section, Resend button
- Realtime subscription on `order_email_deliveries` + `orders` so status updates live

**Ebook templates:** React Email template (server-side rendered to HTML), single email lists সব ই-বুকের download links সহ

---

## কনফার্মেশন দরকার

1. **Ebook file storage** — এখন R2 তে আছে ধরে নিচ্ছি (project এ `r2.server.ts` আছে)। Signed URL expiry কত রাখব — ৭ দিন? না permanent link per order?
2. **Email template design** — আমি একটা Bangla + English hybrid template বানাব (Polytechnic Tutorial ব্র্যান্ডিং, download buttons)। কোনো specific reference/design আছে?
3. **Retry count** — ৩০ মিনিট gap এ ২ বার retry বললেন, তার মানে total ৩টা attempt (initial + 2 retries)। ঠিক আছে?
4. **Manual review পর্যন্ত অর্ডার processing এ** — কনফার্ম? নাকি আলাদা "Attention Required" tab এ সরানো ভাল?
5. **RESEND_WEBHOOK_SECRET** — Resend dashboard এ webhook বানানোর পর signing secret টা add_secret দিয়ে দিতে হবে। রেডি?

Approve করলে migration + edge function + webhook route + UI changes সব করে দিব।
