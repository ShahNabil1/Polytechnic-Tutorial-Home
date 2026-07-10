## Goal

Turn `/workspace/ecommerce/orders` into a real order management console. Every physical/mixed order that a customer confirms at checkout gets persisted server-side, shown in status tabs, and exposes a rich view/edit drawer — with the record shape already matching Steadfast's `create_order` API so the future integration is a one-liner.

## Database (Supabase migration)

New tables (all with GRANTs + RLS + updated_at trigger):

1. **`orders`** — one row per confirmed order
   - `id uuid pk`, `order_no text unique` (e.g. `PTH001`, generated server-side via sequence)
   - `user_id uuid null` (null = guest), `customer_email`, `customer_name`, `customer_phone`, `alternative_phone`
   - `division`, `district`, `thana`, `address_line`, `full_address text` (composed)
   - `subtotal_bdt`, `shipping_bdt`, `discount_bdt`, `total_bdt`, `cod_amount numeric default 0`
   - `payment_status text` (`paid` default), `payment_method text`
   - `status text` — enum-like: `processing | ready_to_ship | shipped | hold | delivered | cancelled | returned | incomplete`
   - `order_type text` — `physical | ebook | mixed`
   - `has_physical bool`, `delivery_type smallint default 0`
   - `note text` (customer-facing / Steadfast note), `item_description text` (auto-composed: `"Title x2, Title2 x1"`)
   - `ip inet`, `user_agent text`, `device_fingerprint text`
   - `steadfast_consignment_id text`, `steadfast_tracking_code text`, `steadfast_status text`, `steadfast_synced_at timestamptz`
   - `idempotency_key text unique` (blocks duplicate submits server-side too)
   - `created_at`, `updated_at`

2. **`order_items`**
   - `id`, `order_id fk`, `product_id`, `bundle_id null`, `is_bundle bool`, `title`, `sku`, `unit_price`, `quantity`, `line_total`, `image_url`, `item_type` (`physical|ebook`)

3. **`order_internal_notes`**
   - `id`, `order_id`, `author_user_id`, `body`, `created_at` — internal-only, staff-visible

4. **`order_status_history`**
   - `id`, `order_id`, `from_status`, `to_status`, `changed_by`, `note`, `created_at`

5. **`blocked_identifiers`**
   - `id`, `kind text` (`ip | fingerprint | phone`), `value text`, `reason`, `blocked_by`, `created_at`, unique(kind, value)

6. **Sequence** `order_no_seq` + SQL function `next_order_no()` returning `'PTH' || lpad(nextval, 3, '0')` (grows past 3 digits).

RLS:
- `orders`, `order_items`, `order_status_history`, `order_internal_notes`, `blocked_identifiers`: only `employee | super_admin` roles can select/update; owning user can select their own orders (for future "My Orders" page — not built now but policy ready). Insert to `orders`/`order_items` allowed for authenticated OR anon (guest checkout) but only via server function using the publishable client; guarded by `idempotency_key` unique + blocklist check inside the server fn.
- Internal notes: insert/select only for internal roles.

## Server functions (`src/lib/orders.functions.ts`)

- `createOrder({ cart, customer, totals, idempotencyKey, fingerprint })` — public (no auth required). Checks `blocked_identifiers` against IP (from request) / fingerprint / phone → throws if blocked. Reuses row if `idempotency_key` exists. Generates `order_no` via `next_order_no()`. Inserts order + items. Returns `{ orderNo, status, id }`.
- `listAdminOrders({ status?, search?, limit, cursor })` — internal-only, filter by tab.
- `getAdminOrder({ id })` — full order + items + notes + history + (if `user_id`) profile snapshot.
- `updateOrderCustomer({ id, patch })` — edit name/phone/address/etc, writes history entry.
- `updateOrderItems({ id, items })` — replace items, recompute totals + item_description.
- `updateOrderStatus({ id, status, note })` — writes history.
- `addInternalNote({ id, body })`.
- `addBlockedIdentifier({ kind, value, reason })` / `removeBlockedIdentifier({ id })`.
- `listBlockedIdentifiers()`.

All internal ones use `requireSupabaseAuth` + `has_role` check for `employee|super_admin`.

## Client integration

- **`src/routes/checkout.index.tsx`** — replace localStorage-only order creation with `createOrder` server fn call. Keep client-side idempotency; also pass idempotencyKey server-side. Collect `device_fingerprint` (simple canvas+UA hash) and send. On success, store snapshot in sessionStorage as before and navigate to `/checkout/success`.
- **`src/lib/fingerprint.ts`** (new) — tiny FP hash (UA + screen + tz + canvas).
- **`src/routes/__root.tsx`** (or a small guard hook) — on mount, check `/api/public/blocklist-check` server route; if blocked, replace the app with a "Access denied" screen. (Server route because it needs raw IP.)

## Orders admin page

Rewrite `src/routes/_authenticated/_internal.workspace.ecommerce.orders.tsx`:

- Header + horizontal tabs: Processing | Ready To Ship | Shipped | Hold | Delivered | Cancelled | Returned | Incomplete. Each tab shows count badge.
- Table rows (top-to-bottom newest first): `#Order No` · `Created (Asia/Dhaka, formatted bn/en)` · `Customer name + phone (tel: link with phone icon)` · `IP / fingerprint (mono, truncated)` · `Total BDT` · `View` button.
- Search box (order no / phone / name).
- **View drawer** (`AdminOrderDrawer.tsx`):
  - Left: customer card — editable fields (name, phone with tel: icon, alt phone, email, division/district/thana/address, note). Save button per section.
  - If `user_id` present: show profile avatar + full profile snapshot (read-only) above the editable form.
  - Items block: current items list with qty/price/line total; "Add product" combobox that searches products; qty +/- and remove. Recompute totals live; Save updates order.
  - Steadfast panel: shows the exact JSON that will be POSTed (invoice=order_no, recipient_*, cod_amount=0, item_description, total_lot=sum(qty), delivery_type=0, note, alternative_phone). Copy button. Placeholder "Send to Steadfast" button (disabled, tooltip "coming soon").
  - Status changer dropdown (writes history).
  - Internal notes thread (staff only, add + list).
  - Block buttons: Block IP · Block Fingerprint · Block Phone (with reason prompt).
  - E-book orders: hide address block (show only what customer provided).

## Steadfast payload contract

Match user's spec exactly:
```
invoice          = order_no                    (PTH001…)
recipient_name   = customer_name
recipient_phone  = customer_phone (11 digits)
alternative_phone= alternative_phone (opt)
recipient_email  = customer_email (opt)
recipient_address= "{address_line}, {thana}, {district}, {division}" (≤250 chars)
cod_amount       = 0
note             = note
item_description = "Title xQty, Title2 xQty2, …"
total_lot        = sum(quantity)
delivery_type    = 0
```
Helper `buildSteadfastPayload(order)` in `src/lib/steadfast.ts` — used by the drawer preview and by the future API call.

## Files to create / edit

**Create**
- `supabase/migrations/…orders.sql` (via migration tool)
- `src/lib/orders.functions.ts`
- `src/lib/orders.ts` (shared types)
- `src/lib/steadfast.ts`
- `src/lib/fingerprint.ts`
- `src/components/internal/AdminOrdersManager.tsx`
- `src/components/internal/AdminOrderDrawer.tsx`
- `src/routes/api/public/blocklist-check.ts` (server route for IP check)

**Edit**
- `src/routes/_authenticated/_internal.workspace.ecommerce.orders.tsx` → render `AdminOrdersManager`
- `src/routes/checkout.index.tsx` → call `createOrder` server fn, pass fingerprint
- `src/routes/checkout.success.tsx` → status/order id now come from server response
- `src/routes/__root.tsx` → mount blocklist check (or via a small `<BlocklistGate>` component)

## Non-goals (this turn)
- Actual Steadfast HTTP call (payload preview only, per user "future connect")
- Customer-facing "My Orders" page (RLS is ready for it later)
- Real-time updates / notifications
- E-book delivery/download flow

Ready to build this on approval.