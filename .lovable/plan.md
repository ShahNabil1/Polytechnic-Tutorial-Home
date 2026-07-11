
## Coupon System — End-to-End Plan

A unified coupon engine that powers the Workspace › Coupons admin page and the checkout redemption flow, structured for three coupon "scopes" that all share one database + validation core.

---

### 1. Three tabs, one engine

Workspace › E-Commerce › Coupons will have 3 tabs, all backed by the same table:

- **Shop Coupons** — for physical books / bundles / online-books (active now)
- **Course Coupons** — for future courses (schema ready; UI shows an empty state until courses exist)
- **Special Coupons** — targeted to specific customers (CRM-gated; UI shows "Available after CRM build" until then, but the fields exist)

A `scope` column (`shop | course | special`) filters each tab. Only Shop coupons apply at `/checkout` for now.

---

### 2. Coupon capabilities

Each coupon supports:

- **Code** (unique, case-insensitive), **Name**, **Description**
- **Discount type**: `percent` or `flat`
- **Discount value** (e.g. 20 for 20% or 100 for ৳100 off)
- **Cap** — max discount amount when percent (e.g. "20% up to ৳100")
- **Minimum spend** (subtotal threshold)
- **Max uses total** and **Max uses per customer**
- **Applies to** (per coupon):
  - All products
  - Specific products (multi-select)
  - Specific categories (multi-select)
  - (Course scope) specific courses — schema ready
  - (Special scope) specific customer user_ids — schema ready
- **Active toggle** (on/off, instantly)
- **Valid from / Valid until** (date range; either optional)
- **Stackable** flag (default off)
- **Excludes shipping** flag (default: discount subtotal only)
- **Soft-delete + Reactivate** (via `deleted_at`; deleted coupons hidden but recoverable)
- **Usage counter** (auto-incremented on successful order)

---

### 3. Database (single table + one child table)

```text
coupons
  id, scope, code (unique lower), name, description,
  discount_type, discount_value, cap_amount,
  min_spend, max_uses_total, max_uses_per_customer,
  applies_to ('all' | 'products' | 'categories' | 'courses' | 'customers'),
  starts_at, ends_at, is_active,
  stackable, exclude_shipping,
  uses_count, created_by, deleted_at,
  created_at, updated_at

coupon_targets
  coupon_id, target_type ('product'|'category'|'course'|'customer'), target_id
  (PK: coupon_id + target_type + target_id)

coupon_redemptions
  id, coupon_id, order_id, user_id (nullable for guests), phone,
  discount_amount, redeemed_at
```

RLS: employees/super_admins manage; `anon` + `authenticated` can call a validation RPC (SECURITY DEFINER) that returns discount info without exposing the table.

---

### 4. Validation logic (shared)

A single Postgres function `validate_coupon(code, subtotal, cart_json, phone, user_id)` returns:

```json
{ "ok": true, "discount": 100, "coupon_id": "...", "reason": null }
```

or

```json
{ "ok": false, "discount": 0, "reason": "expired" | "min_spend" | "max_uses" | "not_applicable" | "inactive" | "not_found" }
```

Same function is called by:
- Checkout UI (via a server function, before order submit)
- `createOrder` server function (re-validates atomically, records redemption, increments `uses_count`)

This guarantees the client-facing preview and the authoritative server calculation never disagree.

---

### 5. Admin UI — `/workspace/ecommerce/coupons`

- **Tabs**: Shop · Course · Special
- **Toolbar**: search by code/name, filter (active/inactive/expired/deleted), "New Coupon" button
- **Table**: Code · Name · Discount · Applies to · Uses · Validity · Status · Actions
- **Actions per row**: Edit · Toggle active · Duplicate · Soft-delete · Reactivate (for deleted)
- **Create/Edit dialog** — one form covering every field above with a searchable multi-select for products/categories (fetched from existing products/categories tables). Course & Customer selectors are wired but disabled with a "coming soon" hint on the relevant tabs.

---

### 6. Checkout UI — `/checkout`

New "Promo code" block in the order-summary card:

- Input + "Apply" button
- On apply: calls `validateCoupon` server fn, shows discount line ("Coupon SAVE20 − ৳100") or a friendly Bangla error
- Applied coupon shown as a pill with an "×" to remove
- Total updates live; discount passed into `createOrder` so the server can re-validate + record the redemption + increment `uses_count`
- Persists in cart state so page reloads keep it
- Adds discount to the incomplete-checkout capture snapshot

---

### Technical notes

- New files: `src/lib/coupons.functions.ts` (`validateCoupon`, `listCoupons`, `upsertCoupon`, `toggleCoupon`, `softDeleteCoupon`, `reactivateCoupon`), `src/components/workspace/coupons/*` (Table, FormDialog, TargetPicker), `src/components/checkout/CouponBlock.tsx`
- `createOrder` extended to accept `couponCode`; re-validates server-side and writes to `coupon_redemptions` in the same transaction as the order.
- `cart-store` gets `appliedCoupon` state + setter/clear.
- Migration includes the three tables, GRANTs, RLS, the `validate_coupon` SECURITY DEFINER function, and the redemption trigger to bump `uses_count`.

---

### Out of scope (this pass)

- Course-specific redemption flow (courses don't exist in the app yet — schema is ready, checkout wiring will land with the course cart).
- Customer-targeted (Special) redemption (waits for CRM customer records; admin UI is stubbed with the field disabled).
- Stacking multiple coupons at once (`stackable` flag stored, but UI enforces one coupon per order for now).

Approve and I'll ship this in one go — migration first, then server fns, admin UI, checkout wiring.
