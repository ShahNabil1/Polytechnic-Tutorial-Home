# Steadfast Courier — Full Integration Plan

## 1. Credentials & Webhook

You'll provide via secure form:
- `STEADFAST_API_KEY`
- `STEADFAST_SECRET_KEY`
- `STEADFAST_BASE_URL` → default `https://portal.packzy.com/api/v1`

I'll auto-generate:
- `STEADFAST_WEBHOOK_SECRET` (64-char random, shared secret you paste into Steadfast dashboard)

**Webhook URL (give this to Steadfast):**
```
https://polyverse-learn-shop.lovable.app/api/public/webhooks/steadfast?secret=<STEADFAST_WEBHOOK_SECRET>
```
(Steadfast webhook has no signature header — auth via query-string secret + timing-safe compare.)

## 2. Database migration

New columns on `orders`:
- `steadfast_last_error text` — exact failure reason from Steadfast
- `steadfast_retry_count int default 0`
- `steadfast_delivery_status text` — raw courier status: `in_review / pending / hold / in_transit / delivered / partial_delivered / cancelled / unknown / delivery_failed / return_requested / return_in_transit / returned` etc.
- `steadfast_status_updated_at timestamptz`

New table `steadfast_status_events` (webhook log, like `order_email_deliveries`):
- `order_id`, `consignment_id`, `tracking_code`, `status`, `raw jsonb`, `received_at`
- RLS: internal staff read; service_role write.

Recompute rule: webhook status `delivered` → `physical_status='delivered'`; `returned`/`partial_delivered` → order `status='returned'`; `cancelled` → `status='cancelled'`; `in_transit` → `physical_status='shipped'` + order `status='shipped'`.

## 3. Server functions & routes

- `src/lib/steadfast.server.ts` — HTTP client (create_order, create_order/bulk-order, status_by_invoice), timeouts, error normalization.
- `src/lib/steadfast.functions.ts`:
  - `dispatchOrderToSteadfast({ orderId })` — internal; used by single RTS.
  - `bulkDispatchToSteadfast({ orderIds })` — chunks 10, calls bulk API, per-order result, marks `steadfast_last_error` on failure but keeps status = `processing`.
  - `retryFailedSteadfast({ orderIds })` — used by 2–3 retry passes.
- `src/routes/api/public/webhooks/steadfast.ts` — verify `secret`, upsert `steadfast_status_events`, update order courier fields + recompute status.

## 4. Order status update rules

- Setting `status='ready_to_ship'` on a **single** order with `has_physical=true` and no `steadfast_consignment_id`:
  - Server fn auto-calls Steadfast single create-order **inside the same transaction/handler**, then persists consignment_id + tracking_code.
  - On failure: keep status as `processing`, store `steadfast_last_error`, surface toast with reason.
- item_description + total_lot are computed from **physical items only** (ebook lines excluded).
- Ebook / digital-only orders: `AdminOrderDrawer` status dropdown hides `ready_to_ship`, `shipped`, `returned` (kept: processing, hold, delivered, cancelled, incomplete).

## 5. Processing tab — Bulk RTS UI

`AdminOrdersManager` Processing tab gets:
- Checkbox column + "Select all physical" header checkbox.
- Sticky action bar: "Send N to Steadfast (RTS)" button.
  - Disabled when selection contains any non-physical order (tooltip: "Selection contains digital-only orders").
- On click → modal with live progress bar:
  - Chunks of 10 via bulk API, shows `x / total` + per-order row (✓ consignment ID or ✗ reason).
  - After first pass, auto-retries failures up to 3 times with backoff.
  - Final failures remain in Processing with red "Failed RTS" badge on the card.

## 6. RTS tab card enhancements

Each RTS card shows a compact Steadfast block:
- Steadfast logo + "Consignment: 123456789" (click to copy, toast "Copied")
- "Tracking: ABCD-1234" (click to copy)
- Live courier status chip (from webhook) styled like Resend chips, with Steadfast logo.

## 7. Status chips (all cards + drawer)

New `SteadfastEventChips` component mirroring `ResendEventChips`:
- Reads `steadfast_status_events` for the order.
- Renders chronological chips with Steadfast logo + status label + timestamp tooltip.
- Shown on order card and inside `AdminOrderDrawer`.

## 8. Returned tab

Webhook status `returned` / `partial_delivered` / `return_in_transit` moves order to `status='returned'` — surfaces automatically in existing Returned tab.

## 9. Failed RTS surfacing

- Card badge: red "Failed RTS" pill (when `has_physical` + `steadfast_last_error` + no consignment).
- Drawer: red alert block with exact `steadfast_last_error` + "Retry" button (calls single dispatch).

## 10. Excluded (per your list)

Not implementing: balance check, payments listing, single payment lookup, police-station lookup.

---

### What I need from you now

1. Approve this plan.
2. After approval, I'll open the secure form for `STEADFAST_API_KEY` + `STEADFAST_SECRET_KEY` (+ optional `STEADFAST_BASE_URL` if non-default), auto-generate `STEADFAST_WEBHOOK_SECRET`, then run the migration and ship the code.