## সমস্যাটা কী

এখন Bulk SMS/Email পাঠানোর পরে UI শুধু একটা টোস্ট দেয়: `SMS: 42 sent · 8 failed`। কার কাছে গেল না, কেন গেল না (ফোন নেই / ইমেইল নেই / bulksmsbd ব্যালান্স শেষ / Resend rate-limit / invalid number) — কিছুই দেখা যায় না। ডেটাবেসে `crm_sms_deliveries` / `crm_email_deliveries` টেবিলে প্রতি সেন্ডের রেকর্ড থাকে (`kind = 'crm_bulk'`, `error_reason`, `provider_status`) কিন্তু ওগুলো এক জায়গায় গ্রুপ করা নেই, তাই "এই ব্যাচের ফেইলগুলা" দেখা বা রিট্রাই করা যায় না। এছাড়া "কনট্যাক্ট নাই" রিসিপিয়েন্টগুলো ক্লায়েন্টেই silently drop হয়ে যায় — কোথাও ট্রেস থাকে না।

## যেভাবে ঠিক করব

### 1. Campaign হিসেবে গ্রুপ করা (ডেটাবেস)

নতুন টেবিল `crm_bulk_campaigns` — এক Bulk send = এক row:

```text
id, channel (sms|email), subject, body, template_id, sender_user_id,
total, sent, failed, skipped_no_contact, created_at
```

`crm_sms_deliveries` / `crm_email_deliveries` এ একটা `campaign_id` কলাম যোগ করা হবে (nullable — আগের manual send-এর জন্য NULL)। এছাড়া "skipped_no_contact" রিসিপিয়েন্টগুলার জন্য delivery টেবিলেই একটা special row লেখা হবে `status='skipped'`, `error_reason='no_phone'`/`'no_email'` দিয়ে — যাতে drill-down এ সবাই একসাথে দেখা যায়।

### 2. Post-send Report Dialog

`sendCrmBulkSms` / `sendCrmBulkEmail` এখন `{ campaign_id, sent, failed, skipped, breakdown: [{ user_id, contact, status, error_reason }] }` ফেরত দেবে। Bulk send করার পর একটা report modal খুলবে যেখানে থাকবে:

- সামারি চিপ: **Sent 42 · Failed 6 · Skipped 12**
- ট্যাব: All / Sent / Failed / Skipped
- প্রতিটা row: কাস্টমারের নাম + ফোন/ইমেইল + status chip + reason (`Insufficient balance`, `Invalid number`, `No phone on file`, `Bounced`, ইত্যাদি)
- এক্সপোর্ট (CSV) বাটন
- **Retry failed** বাটন — শুধু ফেইলগুলা নিয়ে একই বডি রিসেন্ড
- **Retry skipped** — যাদের এখন কনট্যাক্ট আছে (admin CRM এ ফোন/ইমেইল add করার পরে) তাদের বাদ থেকে বের করে আনা

### 3. Campaigns Tab (CRM এ পার্মানেন্ট হিস্টরি)

`/workspace/crm` এ নতুন ট্যাব **Campaigns** — আগের সব bulk send-এর লিস্ট, প্রতিটাতে ক্লিক করলে ওই একই report drawer আবার খুলবে। মানে দুই সপ্তাহ পরেও ফেইলগুলা দেখে রিট্রাই করা যাবে।

### 4. Gateway Health Panel

Bulk dialog-এর উপরে ছোট একটা স্ট্রিপ যেটা preflight করবে:

- **SMS ব্যালান্স**: bulksmsbd-র `smsapi?api_key=...&type=credit` (বা যেটা তারা সাপোর্ট করে) থেকে ব্যালান্স + এই ব্যাচে estimated segments। ব্যালান্স < estimated হলে পাঠানোর বাটন লাল সতর্কতা দেখাবে।
- **Email**: শেষ 24 ঘণ্টায় Resend-এ কতটা পাঠানো হয়েছে (`crm_email_deliveries` count) + daily plan cap-এর ওয়ার্নিং। Resend rate-limit error (`429`) alaada label হিসেবে রিপোর্টে দেখাবে।

এই ব্যালান্স endpoint একটা নতুন server function `getGatewayHealth` যেটা settings-এও দেখানো যাবে।

### 5. Retry Logic (সঠিক আচরণ)

- **Failed with retryable reason** (network, rate-limit `429`, bulksmsbd temporary code): "Retry failed" বাটন directly পুনরায় পাঠাবে; নতুন delivery row লিখবে `attempt_no=2` এবং একই `campaign_id`-তে যোগ হবে।
- **Failed with permanent reason** (invalid phone/email, bounced address): Retry এ include হবে না — reason চিপে "won't retry" ট্যাগ থাকবে; admin কে কাস্টমার প্রোফাইলে গিয়ে ঠিক করতে হবে।
- **Gateway/balance exhausted** (bulksmsbd code 1007 বা Resend 402/429): report-এ বড় ব্যানার — "SMS gateway balance low — recharge then retry"; admin ব্যালান্স রিচার্জ করে report drawer থেকেই "Retry failed" চাপবে।
- **Skipped (no contact)**: retry বাটন disabled; পাশে "Open customer" লিংক — admin গিয়ে contact save করবে, তারপর "Retry skipped" চাপলে যাদের এখন কনট্যাক্ট আছে শুধু তাদেরই পাঠাবে।

### 6. প্রতি রিসিপিয়েন্টের কাছে Delivery History তে ট্রেসেবল

কাস্টমার ডিটেইল পেজের Delivery history section (যেটা আগেই আছে) এ `crm_bulk` kind হলে "Bulk campaign · {name/date}" ব্যাজ দেখাবে — ওই ব্যাজে ক্লিক করলে campaign drawer খুলবে।

## Technical section (ডেভ ডিটেইলস)

- **Migration**: `crm_bulk_campaigns` টেবিল (grants: authenticated select/insert/update, service_role all), RLS: শুধু staff (has_permission `manage_users`) দেখতে/লিখতে পারবে। `crm_sms_deliveries` / `crm_email_deliveries` এ `campaign_id uuid null` + index (`campaign_id`)। Realtime enable করার দরকার নেই — one-shot ফেচ।
- **Skipped rows**: `crm_*_deliveries` এ `status` চেক কনস্ট্রেন্ট থাকলে `'skipped'` value allow করতে হবে; না থাকলে ঠিক আছে। `to_phone`/`to_email` NULL allow করার দরকার হলে migration-এ শিথিল করা হবে।
- **Server functions** (`src/lib/crm-bulk.functions.ts`):
  - `sendCrmBulkSms` / `sendCrmBulkEmail`: শুরুতে `crm_bulk_campaigns` insert → `campaign_id` পাওয়া গেলে every delivery row-এ ওইটা স্ট্যাম্প। skipped রিসিপিয়েন্টের জন্যও একটা row লিখবে। শেষে campaign row-এ counts আপডেট। রিটার্ন-এ `campaign_id` যোগ।
  - নতুন `getCrmCampaigns` (list), `getCrmCampaign` (detail with breakdown grouped by status), `retryCrmCampaignFailed` (retryable-only), `retryCrmCampaignSkipped` (যাদের এখন contact আছে)।
  - নতুন `getGatewayHealth` — bulksmsbd balance + Resend 24h usage। Result 30s cache।
- **Client**:
  - `CrmBulkSendDialog`: এখন `eligible` filter করার বদলে সব রিসিপিয়েন্ট পাঠাবে (skipped সার্ভারেই রেকর্ড হবে)। উপরে gateway health strip।
  - নতুন `CrmBulkReportDrawer.tsx` — send-এর পর অটো ওপেন এবং Campaigns tab থেকেও ওপেন।
  - নতুন `CrmCampaignsPanel.tsx` — CRM tab, listing।
- **Failure taxonomy**: bulksmsbd error codes ম্যাপ (`1007` insufficient balance, `1005` invalid number ইত্যাদি) → `retryable` boolean। Resend errors: `422 invalid` = permanent, `429`/`500` = retryable।

## যা করব না (এই স্কোপে)

- অটো-রিট্রাই ব্যাকগ্রাউন্ড ওয়ার্কার — admin-triggered রিট্রাই এখনকার জন্য যথেষ্ট; auto-retry হলে duplicate send-এর ঝুঁকি।
- Scheduled campaigns / segments UI — এইটা আলাদা ফিচার, ভবিষ্যতে।
- SMS ব্যালান্স রিচার্জ ইন্টিগ্রেশন — শুধু ব্যালান্স দেখাব, রিচার্জ bulksmsbd portal থেকে।