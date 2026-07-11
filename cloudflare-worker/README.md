# PTH Steadfast Worker

Steadfast Courier API এর জন্য standalone Cloudflare Worker। Lovable app এই Worker কে HMAC-signed HTTPS request দিয়ে কল করে; **create-order কল queue এ push হয়ে সাথে সাথে ২০২ ফেরত দেয়** (timeout নেই)। ব্যাকগ্রাউন্ডে queue consumer Steadfast এ call করে Supabase এ consignment/tracking আপডেট দেয়। ভবিষ্যতে Steadfast এর webhook ও এখানে আসবে।

---

## এক-বারের সেটআপ

### 1. Wrangler ইনস্টল ও লগইন

```bash
cd cloudflare-worker
npm install       # or: bun install
npx wrangler login
```

### 2. Queues বানান (একবার)

```bash
npx wrangler queues create steadfast-jobs
npx wrangler queues create steadfast-jobs-dlq
```

### 3. Secrets বসান (production)

```bash
npx wrangler secret put STEADFAST_API_KEY
npx wrangler secret put STEADFAST_SECRET_KEY

# Lovable প্রজেক্টে যেই STEADFAST_WORKER_HMAC_SECRET আছে ঠিক সেই একই value
npx wrangler secret put STEADFAST_WORKER_HMAC_SECRET

# Supabase (Lovable এ যা আছে সেই একই)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Random 32+ char string — Steadfast webhook config এ Step 4 তে বসাতে হবে
npx wrangler secret put STEADFAST_WEBHOOK_SECRET
```

### 4. Deploy

```bash
npx wrangler deploy
```

Deploy এর পরে URL কপি করে Lovable এর secret এ বসান: `STEADFAST_WORKER_URL`।

---

## Endpoint সংক্ষেপ

| Path | Method | কাজ |
|---|---|---|
| `/` | GET | Health check (no auth) |
| `/api/steadfast/balance` | GET | Sync — Steadfast balance |
| `/api/steadfast/status/cid/:cid` | GET | Sync — consignment status |
| `/api/steadfast/create-order` | POST | **Enqueue** → 202 |
| `/api/steadfast/create-order-bulk` | POST | **Enqueue N** → 202 |
| `/api/webhooks/steadfast` | POST | Placeholder (Step 4) |

Request body (single):

```json
{
  "order_id": "uuid-of-orders.id",
  "order_no": "PTH001",
  "payload": {
    "invoice": "PTH001",
    "recipient_name": "Rahim",
    "recipient_phone": "01700000000",
    "recipient_address": "House 1, Road 2, Dhaka",
    "cod_amount": 0,
    "note": "",
    "item_description": "Book x1",
    "total_lot": 1,
    "delivery_type": 0
  }
}
```

Bulk: `{ "orders": [ { …same as above… } ] }` (max 500)।

Queue consumer কাজ:
1. Steadfast `POST /create_order` কল
2. সফল হলে `orders` টেবিলে `steadfast_consignment_id`, `steadfast_tracking_code`, `steadfast_status`, `status='ready_to_ship'`, `steadfast_synced_at` update
3. `order_status_history` তে entry
4. ফেইল হলে exponential backoff retry (60s → 15m), max 5 attempts, তারপর DLQ

---

## Local dev

```bash
cat > .dev.vars <<EOF
STEADFAST_API_KEY=...
STEADFAST_SECRET_KEY=...
STEADFAST_WORKER_HMAC_SECRET=...
STEADFAST_WEBHOOK_SECRET=...
SUPABASE_URL=https://qmqcfzgbkzdedfqrmoah.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
EOF

npx wrangler dev
# http://localhost:8787
```

`wrangler dev` local এ queue simulate করে। Live tail: `npx wrangler tail`।
