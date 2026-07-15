# CRM Phase 2 Plan

Goal: bring CRM customer detail up to parity with the order detail drawer's messaging/tracking surface, plus live cart visibility.

## Scope

### 1. SMS sending (per customer)
- New server fn `sendCrmSms` — mirrors order SMS flow (BulkSMSBD via existing `sms.functions.ts` helpers).
- Template picker (from `sms_templates`) OR free-form typing with variable substitution: `{{name}}`, `{{phone}}`, `{{email}}`, `{{student_id}}`, `{{last_order_no}}`, `{{ltv}}`.
- Recipient = customer's phone (from profile / order / incomplete lead).
- Persist to `order_sms_deliveries`-style table? → reuse a new lightweight table `crm_sms_deliveries` (customer_id/phone/user_id, template_id, body, status, provider_ref, cost, sent_at) OR extend `order_sms_deliveries` with nullable order_id + `context` column. **Decision: new `crm_sms_deliveries` table** — cleaner, avoids polluting order deliveries.

### 2. Email sending + resend + tracking chips
- New server fn `sendCrmEmail` — reuses Resend gateway path from `order-notifications.server.ts`.
- Template picker from `email_templates` + free-form subject/HTML with same variable set.
- Resend: `resendCrmEmail(delivery_id)` re-fires with same payload.
- Tracking: subscribe to Resend webhook events (already handled in `api/public/webhooks/resend.ts`) — extend the webhook to also update `crm_email_deliveries` rows (matched by resend `email_id`).
- New table `crm_email_deliveries` with same shape as `order_email_deliveries`: status enum (`queued`,`sent`,`delivered`,`opened`,`clicked`,`bounced`,`complained`,`failed`), timestamps per event, opens/clicks counters.
- Show tracking as coloured chips in customer detail's Communications tab — identical component styling as order drawer.

### 3. Live cart view (signed-in users only)
- Server fn `getCrmUserCart({ userId })` — reads whatever the app persists carts to. Investigate: is there a `carts` table, or is cart client-side only in localStorage?
- If purely client-side: add a lightweight `user_carts` table (user_id PK, items jsonb, subtotal, updated_at) and a client sync hook that writes on cart changes for signed-in users. Show in CRM as "Current cart" card.
- If server-persisted already: just read it.

### 4. UI wiring in `CrmCustomerDetailPage.tsx`
- Add tabs: Overview / Orders / Enrollments / **Messages** / **Cart**.
- Messages tab: SMS composer + email composer side-by-side, with delivery history + tracking chips below.
- Cart tab: current cart items, subtotal, last updated timestamp, "empty" state.

## Out of scope (Phase 3)
- Bulk select + bulk messaging
- Per-customer coupon generation

## Migration summary
1. `crm_sms_deliveries` table + grants + RLS (internal-only via `has_permission(auth.uid(), 'manage_crm')` or `manage_orders`).
2. `crm_email_deliveries` table + grants + RLS + status enum reuse.
3. `user_carts` table (only if no existing cart persistence) + grants + RLS (`auth.uid() = user_id` for own, admin read via permission).
4. Extend resend webhook handler to also match `crm_email_deliveries`.

## Open questions
1. **Permission gate** — should CRM use `manage_orders`, `manage_users`, or a new `manage_crm` permission? Existing sidebar just checks internal role. Confirm.
2. **Cart persistence** — do you already sync signed-in user carts to Supabase, or is cart currently only in browser storage? I'll check `src/` next; if none, I'll add `user_carts` and a sync hook.
3. **SMS/email cost tracking** — mirror the order flow's cost column?

Reply "go" to proceed with defaults (new `manage_crm` permission, add `user_carts` if missing, mirror cost tracking), or answer the three questions.
