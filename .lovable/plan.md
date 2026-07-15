# CRM Module Plan

একটা নতুন `/workspace/crm` সেকশন বানাবো, ৪টা ট্যাব দিয়ে। সব ট্যাব **লাইভ কম্পিউটেড** — কোনো ম্যানুয়াল স্ট্যাটাস ফিল্ড না, তাই একজন কোর্স/শপ থেকে কিনলে/সাইনআপ করলে অটোমেটিক এক ট্যাব থেকে আরেক ট্যাবে চলে যাবে।

## ট্যাব সংজ্ঞা (SQL views দিয়ে)

1. **Customers (Active)** — signed-up user AND (has active `lms_enrollments` OR has any completed `orders` from shop)
2. **Signed-up, No Purchase Yet** — signed-up user (role=student) AND no active enrollment AND no completed order
3. **Guest / Incomplete** — কোনো auth user নাই এমন phone/email যাদের আছে:
   - `orders` (guest checkout, no user_id) — purchased guests
   - `incomplete_checkouts` — didn't complete
   - যদি সেই email/phone দিয়ে পরে account create হয় → auto ট্যাব 2 বা 1 এ চলে যাবে (কারণ সেগ্মেন্ট computed, and we'll exclude রো যেগুলোর email/phone কোনো `auth.users` এ ম্যাচ করে)

## Detail page (per-customer)

`/workspace/crm/$id` — employee/instructor detail page এর মতোই সব প্রযোজ্য ফিচার:
- Basic profile, contact info (email/phone সহ admin change), address
- **LTV card** — total spent (completed orders sum), order count, avg order value, first/last purchase date, enrolled courses count
- **Order history** — সব অর্ডার লিস্ট (existing AdminOrderDrawer এ ক্লিক করে)
- **Enrollments** — সাব্জেক্ট/কোর্স লিস্ট
- **Live Cart** — signed-in user এর জন্য cart items (persist হয় localStorage এ, কিন্তু cart items ডেটাবেসে persist নাই — [দেখুন Technical])
- **SMS** — sms_templates থেকে template select/type with `{{name}}` variables, existing `sendOrderSms` pattern এর মতো নতুন `sendCustomerSms` server fn, `order_sms_deliveries` এর মতো `customer_sms_deliveries` টেবিলে লগ (chips সহ)
- **Email** — email_templates select/type, Resend দিয়ে send, `customer_email_deliveries` এ লগ, existing `ResendEventChips` reuse করে tracking (delivered/opened/clicked)
- **Coupon** — এই customer এর জন্য special coupon বানানোর বাটন → existing `coupons` টেবিলে `applies_to='customers'` + `coupon_targets` এ এই user_id দিয়ে insert, এক ক্লিকে

## Bulk actions (list view এ)

- Checkbox দিয়ে multiple select
- **Bulk SMS** — template select, `{{name}}` etc. প্রতি রেসিপিয়েন্টের জন্য render হয়ে যাবে
- **Bulk Email** — same, personalized per recipient

## Technical

### Database (migration)
- **View `crm_customer_summary`** (security_invoker=on, `TO authenticated` grant, admin/manage_users দিয়ে filtered): joins `auth.users` (via `profiles`), aggregates orders total/count, enrollment count, computes `segment` column ('active' | 'signed_no_purchase')
- **View `crm_guest_leads`**: unions guest `orders` (user_id IS NULL) with `incomplete_checkouts`, dedupes by phone/email, excludes any phone/email that matches an existing `auth.users` row (auto-migration when they sign up)
- **Tables**:
  - `customer_sms_deliveries` (mirrors `order_sms_deliveries` shape, `target_user_id` or `target_phone`)
  - `customer_email_deliveries` (mirrors `order_email_deliveries`)
  - Both: GRANT + RLS (`manage_users` only), Resend webhook already logs to email deliveries — will extend that webhook to also match customer_email_deliveries by resend message_id

### Server functions (`src/lib/crm.functions.ts`)
- `listCrmActive({search, page})`, `listCrmSignedNoPurchase(...)`, `listCrmGuests(...)` — all use `requireSupabaseAuth` + `manage_users` check
- `getCrmCustomer(id)` — profile + LTV + orders + enrollments
- `sendCustomerSms({userId?, phone, message})`, `sendCustomerEmail({userId?, email, subject, html})`
- `bulkSendSms({recipients: [{userId?, phone, vars}], templateBody})`, `bulkSendEmail(...)`
- `createCustomerCoupon({userId, code, discountType, value, ...})`
- `getUserCart(userId)` — [see below]

### Live cart tracking
Currently cart is client-side only (`zustand + persist` in `cart-store.ts`). To show it admin-side, need to persist to DB. Add table `user_carts (user_id PK, items jsonb, updated_at)` — sync from `cart-store` on change when user is signed in (add a small subscribe hook). Admin reads that row.

### Routes
- `src/routes/_authenticated/_internal.workspace.crm.tsx` — layout with 4 tabs
- `.crm.customers.tsx`, `.crm.signed.tsx`, `.crm.guests.tsx`, `.crm.$id.tsx`

### Reused components
- `AdminBasicProfileForm`, `AdminContactChangeCard`, `NidUploadCard` (if applicable), `ResendEventChips`, `SmsTemplatesManager` template picker logic, `AdminOrderDrawer` for order details

### Sidebar
Add "CRM" entry in `InternalShell` nav under a `manage_users` gate.

## স্কোপ ও ধাপ

কারণ এটা বড় ফিচার, আমি ধাপে ধাপে করব:

**Phase 1 (এই মেসেজে যদি approve করেন):**
- DB migration: views + 2 delivery tables + user_carts table
- CRM routes + 4 tabs list + basic search/pagination
- Customer detail page: profile view, LTV, orders, enrollments
- Sidebar link

**Phase 2:**
- SMS send + templates + delivery chips
- Email send + Resend webhook extend + chips
- Live cart view + cart sync hook

**Phase 3:**
- Bulk SMS/Email
- Per-customer coupon quick-create

Approve করলে Phase 1 দিয়ে শুরু করব।
