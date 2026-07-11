# PTH Steadfast Worker

Steadfast Courier API এর জন্য standalone Cloudflare Worker। Lovable app এই Worker কে HMAC-signed HTTPS request দিয়ে কল করে, Worker Steadfast এ কল করে result ফেরত দেয়। ভবিষ্যতে Steadfast এর webhook ও এখানে আসবে।

---

## এক-বারের সেটআপ

### 1. Wrangler ইনস্টল ও লগইন

```bash
cd cloudflare-worker
npm install       # or: bun install
npx wrangler login
```

### 2. Secrets বসান (production)

আপনার Steadfast dashboard থেকে API Key + Secret Key নিন। বাকিগুলো নিচের মতো:

```bash
npx wrangler secret put STEADFAST_API_KEY
npx wrangler secret put STEADFAST_SECRET_KEY

# Lovable প্রজেক্টে যেই LOVABLE_HMAC_SECRET আছে ঠিক সেই একই value দিন
npx wrangler secret put LOVABLE_HMAC_SECRET

# Supabase — Lovable এ যা আছে সেই একই
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# আপনি নিজে একটা random string বানান (openssl rand -hex 32),
# পরে Steadfast dashboard এ webhook config এ একই value দিতে হবে (Step 4)
npx wrangler secret put STEADFAST_WEBHOOK_SECRET
```

### 3. Deploy

```bash
npx wrangler deploy
```

Deploy শেষে একটা URL পাবেন, যেমন:

```
https://pth-steadfast.<your-subdomain>.workers.dev
```

এই URL Lovable এর secret এ বসাতে হবে: `STEADFAST_WORKER_URL`।

---

## Local dev

```bash
# .dev.vars ফাইল বানান (git ignore করা)
cat > .dev.vars <<EOF
STEADFAST_API_KEY=...
STEADFAST_SECRET_KEY=...
LOVABLE_HMAC_SECRET=...
STEADFAST_WEBHOOK_SECRET=...
SUPABASE_URL=https://qmqcfzgbkzdedfqrmoah.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
EOF

npx wrangler dev
# http://localhost:8787
```

Local testing এর সময় Lovable এর `.env.local` এ:

```
VITE_STEADFAST_WORKER_URL=http://localhost:8787
```

---

## Manual test — Balance endpoint (Step 1)

HMAC সহ curl সহজ না, তাই Lovable UI থেকে "Check Balance" button ব্যবহার করুন। শুধু connectivity test করতে চাইলে:

```bash
curl https://pth-steadfast.<subdomain>.workers.dev/
# {"ok":true,"service":"pth-steadfast","ts":...}
```

---

## যা এখনো wire করা হয়নি

- `/api/steadfast/create-order`, `/status/*`, `/returns/*`, `/payments/*` — Step 2 & 3
- `/api/webhooks/steadfast` real handler → Supabase update — Step 4
