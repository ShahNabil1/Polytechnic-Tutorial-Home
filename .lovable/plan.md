
# Phase 1: E-commerce + গেস্ট চেকআউট

পুরো প্ল্যাটফর্মটা বিশাল — এই ফেজে শুধু পাবলিক ল্যান্ডিং পেজ + প্রোডাক্ট + কার্ট + গেস্ট চেকআউট flow টুকু end-to-end কাজ করার মতো বানাব। LMS, Admin CRM, Live Class, RBAC — পরের ফেজে।

## যা বানাব (Scope)

### পাবলিক পেজ (বাংলা UI)
- **হোম / ল্যান্ডিং** — hero, ফিচার সেকশন, ফিচার্ড প্রোডাক্ট, FAQ, footer
- **শপ** — সব প্রোডাক্ট (ফিজিক্যাল বই / eBook / সুপার সাজেশন PDF) grid + ফিল্টার (ডিপার্টমেন্ট, সেমিস্টার, টাইপ)
- **প্রোডাক্ট ডিটেইল পেজ** — কভার, বর্ণনা, দাম, "Add to Cart"
- **কার্ট** — quantity, remove, subtotal, শিপিং preview (ফিজিক্যাল হলে)
- **চেকআউট (গেস্ট)** — দুই ভেরিয়েন্ট:
  - ফিজিক্যাল: নাম, ফোন, ঠিকানা → শিপিং চার্জ অটো (ঢাকা/ঢাকার বাইরে flat rate placeholder)
  - ডিজিটাল: নাম, ইমেইল, ফোন
- **অর্ডার সাকসেস / ব্যর্থ পেজ**

### ব্যাকএন্ড (আপনার Supabase)
টেবিল:
- `products` (id, title, slug, type: physical/ebook/suggestion, price, cover_url, file_path, department_ids[], semester_ids[], stock, is_active)
- `departments`, `semesters` (lookup)
- `orders` (id, order_no, customer_name, phone, email, address, city, type, subtotal, shipping, total, status: pending/paid/failed, payment_ref, created_at)
- `order_items` (order_id, product_id, qty, price)
- `abandoned_carts` (email/phone, cart_json, last_step, created_at)
- `download_tokens` (order_id, product_id, token, expires_at) — ডিজিটাল ডেলিভারির জন্য

RLS: পাবলিক SELECT শুধু `products/departments/semesters` (is_active only, safe columns)। orders/tokens শুধু service_role।

### সার্ভার ফাংশন / রুট
- `getProducts`, `getProductBySlug` — publishable client, পাবলিক
- `createOrder` — কার্ট validate → order + items insert (pending) → Paystation redirect URL রিটার্ন
- `/api/public/webhooks/paystation` — পেমেন্ট callback verify → order status=paid → ডিজিটাল হলে download_token জেনারেট → Resend ইমেইল
- `/api/public/downloads/[token]` — টোকেন ভেরিফাই → R2 signed URL redirect (বা mock)
- `saveAbandonedCart` — চেকআউটে ইনফো ভরার সাথে সাথে debounced save
- Steadfast "send to courier" — এই ফেজে skip (Admin panel এর সাথে পরে)

### Integrations (placeholder mode)
যেহেতু কিছু API key নাই — এইভাবে হ্যান্ডেল করব:
- **Paystation** — key থাকলে real redirect, না থাকলে mock success/fail টগল
- **Resend** — key থাকলে ইমেইল যাবে, না থাকলে console log + DB তে টোকেন সেভ (manual test)
- **Cloudflare R2** — key থাকলে signed URL, না থাকলে DB তে file_path রেখে placeholder download endpoint
- **BulkSMSBD, Steadfast** — এই ফেজে skip

প্রতিটার জন্য env var check → gracefully fallback। পরে key যোগ করলেই live হবে।

## Design Direction
বাংলা এডুটেক (10 Minute School / Shikho vibe): 
- ফন্ট: **Hind Siliguri** (বাংলা) + **Inter** (English/number) — @fontsource দিয়ে
- Primary: গাঢ় সবুজ বা নীল (edutech trust) — final direction থেকে
- Modern, clean cards, generous whitespace, বড় CTA button
- Motion for React দিয়ে subtle hover/entrance

আপনি "মডার্ন এডুটেক লুক" বলেছেন কিন্তু কোনো specific reference দেননি — তাই **3টা design direction জেনারেট করে দেখাব** (create_directions), আপনি একটা পছন্দ করলে সেটার উপর বানাব।

## যা এই ফেজে **নেই** (পরের ফেজ)
- ইউজার সাইন-আপ / লগইন / স্টুডেন্ট ড্যাশবোর্ড / My Courses
- অ্যাডমিন প্যানেল, RBAC, CRM, CMS builder, 2FA
- Live class, Bunny.net ভিডিও, 2-device limit, anti-share
- Instructor panel
- Steadfast auto-send, BulkSMSBD, SMS reminders
- কোর্স হায়ারার্কি (chapter/lesson) — শুধু "সুপার সাজেশন PDF" প্রোডাক্ট আকারে থাকবে

## Tech
- TanStack Start (already scaffolded)
- আপনার নিজের Supabase — connect করতে হবে (URL + publishable key + service_role key দিতে হবে build mode এ)
- Tailwind v4, shadcn, framer-motion, zod

## পরের ধাপ (build mode এ গেলে)
1. Design directions জেনারেট → আপনি একটা পছন্দ করবেন
2. Supabase connect (আপনার keys)
3. Migration: টেবিল + RLS + seed (sample প্রোডাক্ট)
4. পাবলিক পেজগুলো + কার্ট (localStorage) + চেকআউট flow
5. Paystation + webhook + Resend + R2 (env থাকলে live, নাহলে mock)
6. Abandoned cart capture

Approve করলে আগে design directions দিয়ে শুরু করব।
