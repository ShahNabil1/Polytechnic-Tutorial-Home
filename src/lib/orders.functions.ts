import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { composeFullAddress, composeItemDescription, ORDER_STATUSES } from "@/lib/orders";

function serverPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureStaff(context: { supabase: any; userId: string }) {
  const [{ data: isEmp }, { data: isAdm }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "employee" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!isEmp && !isAdm) throw new Error("Forbidden");
}

// -------- CREATE ORDER (public / guest) --------

const CreateOrderInput = z.object({
  idempotencyKey: z.string().min(4).max(120),
  customer: z.object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().regex(/^01[3-9]\d{8}$/),
    email: z.string().trim().email().optional().or(z.literal("")),
    division: z.string().max(80).optional().or(z.literal("")),
    district: z.string().max(80).optional().or(z.literal("")),
    upazila: z.string().max(80).optional().or(z.literal("")),
    address: z.string().max(250).optional().or(z.literal("")),
    note: z.string().max(500).optional().or(z.literal("")),
    alternativePhone: z.string().max(20).optional().or(z.literal("")),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        title: z.string().min(1).max(200),
        unitPrice: z.number().nonnegative(),
        quantity: z.number().int().positive().max(999),
        image: z.string().url().optional().or(z.literal("")),
        isBundle: z.boolean().optional(),
        isOnlineBook: z.boolean().optional(),
        type: z.string().max(30).optional(),
      }),
    )
    .min(1)
    .max(50),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    shipping: z.number().nonnegative(),
    discount: z.number().nonnegative().optional(),
    total: z.number().nonnegative(),
  }),
  fingerprint: z.string().max(80).optional().or(z.literal("")),
  userId: z.string().uuid().optional().nullable(),
  source: z.enum(["website", "direct", "manual", "fb_utm", "google", "other"]).optional(),
  sourceDetail: z.string().max(200).optional().or(z.literal("")),
  couponCode: z.string().max(60).optional().or(z.literal("")),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateOrderInput.parse(d))
  .handler(async ({ data }) => {
    // Use the admin client for the create flow: this is a public server fn
    // (guest checkout) so it runs as anon; anon has no SELECT policy on
    // `orders` / `blocked_identifiers`, which would make the blocklist check,
    // idempotency lookup, and `.select()` after insert all silently return
    // nothing. Zod input validation + fingerprint/IP/phone blocklist checks
    // above provide the safety layer instead of RLS here.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;

    let ip = "";
    let ua = "";
    try {
      ip = getRequestIP({ xForwardedFor: true }) || "";
      ua = getRequestHeader("user-agent") || "";
    } catch {}

    // Blocklist check
    const checks: Array<{ kind: "ip" | "fingerprint" | "phone"; value: string }> = [];
    if (ip) checks.push({ kind: "ip", value: ip });
    if (data.fingerprint) checks.push({ kind: "fingerprint", value: data.fingerprint });
    if (data.customer.phone) checks.push({ kind: "phone", value: data.customer.phone });
    if (checks.length) {
      const { data: blocked } = await sb
        .from("blocked_identifiers")
        .select("kind,value")
        .or(checks.map((c) => `and(kind.eq.${c.kind},value.eq.${c.value})`).join(","));
      if (blocked && blocked.length) {
        throw new Error("BLOCKED: This device / phone / IP is blocked from placing orders.");
      }
    }

    // Idempotency: reuse
    const { data: existing } = await sb
      .from("orders")
      .select("id, order_no, status")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { id: existing.id, orderNo: existing.order_no, status: existing.status };
    }

    // Generate order number
    const { data: orderNoRow, error: seqErr } = await sb.rpc("next_order_no");
    if (seqErr || !orderNoRow) throw new Error(seqErr?.message || "Failed to allocate order number");
    const orderNo = orderNoRow as unknown as string;

    const hasPhysical = data.items.some((i) => !i.isOnlineBook && i.type !== "ebook");
    const hasEbook = data.items.some((i) => i.isOnlineBook || i.type === "ebook");
    const orderType: "physical" | "ebook" | "mixed" = hasPhysical && hasEbook
      ? "mixed"
      : hasPhysical
        ? "physical"
        : "ebook";

    const fullAddr = composeFullAddress({
      address_line: data.customer.address || null,
      thana: data.customer.upazila || null,
      district: data.customer.district || null,
      division: data.customer.division || null,
    });
    const itemDesc = composeItemDescription(
      data.items.map((i) => ({ title: i.title, quantity: i.quantity })),
    );

    // ---- Server-authoritative price recomputation ----
    // Never trust client-submitted prices. Look up the current price for every
    // line from products / product_bundles, and reject the order if a referenced
    // item is missing, inactive, or not priced.
    const bundleIdOf = (raw: string) => raw.startsWith("bundle:") ? raw.slice(7) : raw;
    const productIds = data.items
      .filter((i) => !i.isBundle)
      .map((i) => i.productId)
      .filter((p) => isUuid(p));
    const bundleIds = data.items
      .filter((i) => i.isBundle)
      .map((i) => bundleIdOf(i.productId))
      .filter((p) => isUuid(p));

    const [productsRes, bundlesRes] = await Promise.all([
      productIds.length
        ? sb.from("products").select("id, price, is_active, title").in("id", productIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
      bundleIds.length
        ? sb.from("product_bundles").select("id, price, is_active, title").in("id", bundleIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (bundlesRes.error) throw new Error(bundlesRes.error.message);
    const productMap = new Map<string, { price: number; is_active: boolean; title: string }>(
      (productsRes.data ?? []).map((r: any) => [r.id, { price: Number(r.price), is_active: !!r.is_active, title: r.title }]),
    );
    const bundleMap = new Map<string, { price: number; is_active: boolean; title: string }>(
      (bundlesRes.data ?? []).map((r: any) => [r.id, { price: Number(r.price), is_active: !!r.is_active, title: r.title }]),
    );

    type PricedItem = (typeof data.items)[number] & { serverUnitPrice: number; serverLineTotal: number };
    const pricedItems: PricedItem[] = data.items.map((i) => {
      const rec = i.isBundle
        ? bundleMap.get(bundleIdOf(i.productId))
        : (isUuid(i.productId) ? productMap.get(i.productId) : undefined);
      if (!rec) throw new Error(`Item not found or unavailable: ${i.title}`);
      if (!rec.is_active) throw new Error(`Item is no longer available: ${rec.title}`);
      if (!Number.isFinite(rec.price) || rec.price < 0) {
        throw new Error(`Item is not priced: ${rec.title}`);
      }
      const unit = rec.price;
      return { ...i, serverUnitPrice: unit, serverLineTotal: unit * i.quantity };
    });
    const serverSubtotal = pricedItems.reduce((s, i) => s + i.serverLineTotal, 0);

    // ---- Coupon revalidation (authoritative) ----
    let couponId: string | null = null;
    let discountAmount = 0;
    if (data.couponCode && data.couponCode.trim()) {
      const productUuids = pricedItems
        .filter((i) => !i.isBundle)
        .map((i) => i.productId)
        .filter((p) => isUuid(p));
      let categoryIds: string[] = [];
      if (productUuids.length) {
        const { data: subs } = await sb
          .from("product_subcategories")
          .select("category_id")
          .in("product_id", productUuids);
        categoryIds = Array.from(new Set((subs ?? []).map((s: any) => s.category_id)));
      }
      const { data: vres, error: vErr } = await sb.rpc("validate_coupon", {
        _code: data.couponCode.trim(),
        _subtotal: serverSubtotal,
        _product_ids: productUuids,
        _category_ids: categoryIds,
        _phone: data.customer.phone,
        _user_id: null,
        _scope: "shop",
      } as any);
      if (!vErr && vres) {
        const r = vres as any;
        if (r.ok) {
          couponId = r.coupon_id as string;
          discountAmount = Number(r.discount || 0);
        }
      }
    }
    const finalDiscount = discountAmount;
    // Trust client shipping only (non-financial risk for COD/flat shipping),
    // but recompute subtotal + total server-side from DB prices.
    const shipping = Math.max(0, Number(data.totals.shipping) || 0);
    const finalTotal = Math.max(0, serverSubtotal + shipping - finalDiscount);

    const { data: order, error: insErr } = await sb
      .from("orders")
      .insert({
        order_no: orderNo,
        user_id: data.userId ?? null,
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        customer_email: data.customer.email || null,
        alternative_phone: data.customer.alternativePhone || null,
        division: data.customer.division || null,
        district: data.customer.district || null,
        thana: data.customer.upazila || null,
        address_line: data.customer.address || null,
        full_address: fullAddr || null,
        subtotal_bdt: serverSubtotal,
        shipping_bdt: shipping,
        discount_bdt: finalDiscount,
        total_bdt: finalTotal,
        cod_amount: 0,
        payment_status: "paid",
        payment_method: "paystation_test",
        status: "processing",
        order_type: orderType,
        has_physical: hasPhysical,
        digital_status: hasEbook ? "pending" : "not_applicable",
        physical_status: hasPhysical ? "pending" : "not_applicable",
        delivery_type: 0,
        note: data.customer.note || null,
        item_description: itemDesc,
        ip: ip || null,
        user_agent: ua || null,
        device_fingerprint: data.fingerprint || null,
        idempotency_key: data.idempotencyKey,
        source: data.source || "website",
        source_detail: data.sourceDetail || null,
      } as any)
      .select("id, order_no, status")
      .single();
    if (insErr) {
      // Race on idempotency
      if (String(insErr.message).includes("idempotency_key")) {
        const { data: again } = await sb
          .from("orders")
          .select("id, order_no, status")
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (again) return { id: again.id, orderNo: again.order_no, status: again.status };
      }
      throw new Error(insErr.message);
    }

    const itemsRows = pricedItems.map((i) => ({
      order_id: order.id,
      product_id: i.isBundle ? null : (isUuid(i.productId) ? i.productId : null),
      bundle_id: i.isBundle && isUuid(bundleIdOf(i.productId)) ? bundleIdOf(i.productId) : null,
      is_bundle: !!i.isBundle,
      title: i.title,
      unit_price: i.serverUnitPrice,
      quantity: i.quantity,
      line_total: i.serverLineTotal,
      image_url: i.image || null,
      item_type: i.isOnlineBook || i.type === "ebook" ? "ebook" : "physical",
    }));
    const { error: itemErr } = await sb.from("order_items").insert(itemsRows as any);
    if (itemErr) throw new Error(itemErr.message);


    // Record coupon redemption (fires trigger to bump uses_count)
    if (couponId && discountAmount > 0) {
      await sb.from("coupon_redemptions").insert({
        coupon_id: couponId,
        order_id: order.id,
        user_id: data.userId ?? null,
        phone: data.customer.phone,
        discount_amount: discountAmount,
      } as any);
    }

    // On successful order: remove any incomplete-checkout rows for this phone.
    await sb.from("incomplete_checkouts").delete().eq("customer_phone", data.customer.phone);

    // Fire-and-forget: trigger instant ebook delivery for ebook/mixed orders
    if (hasEbook) {
      triggerEbookDelivery(order.id);
    }

    // Fire-and-forget: order confirmation SMS + email (respects `enabled` toggle on templates)
    (async () => {
      try {
        const { sendOrderConfirmationSms, sendOrderConfirmationEmail } = await import(
          "@/lib/order-notifications.server"
        );
        const payload = {
          orderId: order.id,
          orderNo: order.order_no as string,
          customerName: data.customer.name,
          customerPhone: data.customer.phone,
          customerEmail: data.customer.email || null,
          totalBdt: finalTotal,
        };
        await Promise.all([
          sendOrderConfirmationSms(sb, payload),
          sendOrderConfirmationEmail(sb, payload),
        ]);
      } catch (err) {
        console.error("order confirmation dispatch failed", err);
      }
    })();

    return { id: order.id, orderNo: order.order_no, status: order.status };
  });

function triggerEbookDelivery(orderId: string) {
  try {
    const host = getRequestHeader("host") || getRequestHeader("x-forwarded-host") || "";
    const proto = getRequestHeader("x-forwarded-proto") || "https";
    if (!host) return;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!key) return;
    // Fire-and-forget: don't await; log errors only
    fetch(`${proto}://${host}/api/public/hooks/deliver-ebook-batch`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key },
      body: JSON.stringify({ order_id: orderId }),
    }).catch((err) => console.error("triggerEbookDelivery failed", err));
  } catch (err) {
    console.error("triggerEbookDelivery error", err);
  }
}


function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// -------- ADMIN: list orders --------

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
        search: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).max(100000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;
    let q = context.supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.trim();
      q = q.or(
        `order_no.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`,
      );
    }
    const { data: rows, error, count: total } = await q;
    if (error) throw new Error(error.message);

    // counts per status (merge incomplete_checkouts into the "incomplete" bucket)
    const [{ data: countsRaw }, { count: incompleteCheckouts }] = await Promise.all([
      context.supabase.from("orders").select("status"),
      context.supabase.from("incomplete_checkouts").select("id", { count: "exact", head: true }),
    ]);
    const counts: Record<string, number> = {};
    for (const r of countsRaw ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    counts.incomplete = (counts.incomplete ?? 0) + (incompleteCheckouts ?? 0);

    // Attach latest Resend email delivery events per order for status chips.
    const orderIds = (rows ?? []).map((r: any) => r.id);
    const eventsByOrder: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: deliveries } = await context.supabase
        .from("order_email_deliveries")
        .select("order_id, attempt_no, status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, error_reason, updated_at, created_at")
        .in("order_id", orderIds)
        .order("attempt_no", { ascending: true });
      for (const d of deliveries ?? []) {
        // Merge across attempts so any positive event (opened/clicked/delivered) is preserved.
        const cur = eventsByOrder[d.order_id] ?? {
          status: d.status,
          sent_at: null, delivered_at: null, opened_at: null,
          clicked_at: null, bounced_at: null, error_reason: null,
          updated_at: d.updated_at,
        };
        cur.status = d.status; // latest attempt status
        cur.sent_at = cur.sent_at ?? d.sent_at;
        cur.delivered_at = cur.delivered_at ?? d.delivered_at;
        cur.opened_at = cur.opened_at ?? d.opened_at;
        cur.clicked_at = cur.clicked_at ?? d.clicked_at;
        cur.bounced_at = cur.bounced_at ?? d.bounced_at;
        cur.error_reason = d.error_reason ?? cur.error_reason;
        cur.updated_at = d.updated_at ?? cur.updated_at;
        eventsByOrder[d.order_id] = cur;
      }
    }

    const orders = (rows ?? []).map((r: any) => ({
      ...r,
      ip: r.ip == null ? null : String(r.ip),
      email_events: eventsByOrder[r.id] ?? null,
    }));
    return { orders, counts, total: total ?? orders.length };
  });


// -------- ADMIN: counts only (used to keep tab badges live) --------
export const getAdminOrderCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const [{ data: countsRaw }, { count: incompleteCheckouts }] = await Promise.all([
      context.supabase.from("orders").select("status"),
      context.supabase.from("incomplete_checkouts").select("id", { count: "exact", head: true }),
    ]);
    const counts: Record<string, number> = {};
    for (const r of countsRaw ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    counts.incomplete = (counts.incomplete ?? 0) + (incompleteCheckouts ?? 0);
    return { counts };
  });

// -------- ADMIN: get one order --------

export const getAdminOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const [
      { data: order, error: oe },
      { data: items },
      { data: notes },
      { data: history },
      { data: deliveries },
      { data: smsDeliveries },
    ] = await Promise.all([
      context.supabase.from("orders").select("*").eq("id", data.id).single(),
      context.supabase.from("order_items").select("*").eq("order_id", data.id).order("created_at"),
      context.supabase
        .from("order_internal_notes")
        .select("*")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("order_email_deliveries")
        .select("*")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("order_sms_deliveries")
        .select("*")
        .eq("order_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (oe) throw new Error(oe.message);

    let profile: any = null;
    if (order?.user_id) {
      const { data: p } = await context.supabase
        .from("profiles")
        .select("*")
        .eq("id", order.user_id)
        .maybeSingle();
      profile = p;
    }
    const orderOut = order ? { ...order, ip: order.ip == null ? null : String(order.ip) } : null;

    // Enrich notes + sms deliveries with author display name
    const authorIds = Array.from(
      new Set([
        ...(notes ?? []).map((n: any) => n.author_user_id).filter(Boolean),
        ...(smsDeliveries ?? []).map((s: any) => s.sender_user_id).filter(Boolean),
      ]),
    );
    let authorMap: Record<string, string> = {};
    if (authorIds.length) {
      const { data: authors } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", authorIds);
      for (const a of authors ?? []) {
        authorMap[a.id] =
          (a.full_name && String(a.full_name).trim()) ||
          (a.email && String(a.email).split("@")[0]) ||
          "Staff";
      }
    }
    const notesOut = (notes ?? []).map((n: any) => ({
      ...n,
      author_name: n.author_user_id ? authorMap[n.author_user_id] ?? "Staff" : "System",
    }));
    const smsOut = (smsDeliveries ?? []).map((s: any) => ({
      ...s,
      sender_name: s.sender_user_id ? authorMap[s.sender_user_id] ?? "Staff" : "System",
    }));
    return {
      order: orderOut,
      items: items ?? [],
      notes: notesOut,
      history: history ?? [],
      profile,
      deliveries: deliveries ?? [],
      smsDeliveries: smsOut,
    };
  });

// -------- ADMIN: update customer / order fields --------

export const updateOrderCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          customer_name: z.string().min(1).max(100).optional(),
          customer_phone: z.string().regex(/^01[3-9]\d{8}$/).optional(),
          alternative_phone: z.string().max(20).nullable().optional(),
          customer_email: z.string().email().nullable().optional().or(z.literal("")),
          division: z.string().max(80).nullable().optional(),
          district: z.string().max(80).nullable().optional(),
          thana: z.string().max(80).nullable().optional(),
          address_line: z.string().max(250).nullable().optional(),
          note: z.string().max(500).nullable().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const patch: any = { ...data.patch };
    if (patch.customer_email === "") patch.customer_email = null;
    // recompute full_address if any address part is in patch
    if (["division", "district", "thana", "address_line"].some((k) => k in patch)) {
      const { data: curr } = await context.supabase
        .from("orders")
        .select("division,district,thana,address_line")
        .eq("id", data.id)
        .single();
      const merged = { ...curr, ...patch };
      patch.full_address = composeFullAddress(merged as any);
    }
    const { error } = await context.supabase.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- ADMIN: replace items --------

export const updateOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        items: z
          .array(
            z.object({
              product_id: z.string().uuid().nullable().optional(),
              title: z.string().min(1).max(200),
              sku: z.string().max(60).nullable().optional(),
              unit_price: z.number().nonnegative(),
              quantity: z.number().int().positive().max(999),
              image_url: z.string().url().nullable().optional().or(z.literal("")),
              item_type: z.enum(["physical", "ebook"]).default("physical"),
            }),
          )
          .min(1),
        shipping_bdt: z.number().nonnegative().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const shipping = data.shipping_bdt ?? 0;
    const total = subtotal + shipping;
    const itemDesc = composeItemDescription(
      data.items.map((i) => ({ title: i.title, quantity: i.quantity })),
    );

    const { error: delErr } = await context.supabase
      .from("order_items")
      .delete()
      .eq("order_id", data.id);
    if (delErr) throw new Error(delErr.message);

    const rows = data.items.map((i) => ({
      order_id: data.id,
      product_id: i.product_id ?? null,
      is_bundle: false,
      title: i.title,
      sku: i.sku ?? null,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
      image_url: i.image_url || null,
      item_type: i.item_type,
    }));
    const { error: insErr } = await context.supabase.from("order_items").insert(rows as any);
    if (insErr) throw new Error(insErr.message);

    const updatePayload: any = {
      subtotal_bdt: subtotal,
      total_bdt: total,
      item_description: itemDesc,
    };
    if (data.shipping_bdt !== undefined) updatePayload.shipping_bdt = shipping;

    const { error: uErr } = await context.supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, subtotal, total };
  });

// -------- ADMIN: status --------

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(ORDER_STATUSES as [string, ...string[]]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { data: curr } = await context.supabase
      .from("orders")
      .select("status, has_physical, steadfast_consignment_id")
      .eq("id", data.id)
      .single();

    // Auto-dispatch to Steadfast when transitioning a physical order into RTS.
    // Runs inline so the drawer surfaces the exact courier error if it fails
    // (order stays in `processing` in that case).
    if (
      data.status === "ready_to_ship" &&
      curr?.has_physical &&
      !curr?.steadfast_consignment_id
    ) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { dispatchOrderById } = await import("@/lib/steadfast.server");
      const res = await dispatchOrderById(supabaseAdmin, data.id);
      if (!res.ok) {
        // dispatchOrderById already persisted the error onto the order.
        throw new Error(res.error || "Steadfast dispatch failed");
      }
      // dispatchOrderById already set status=ready_to_ship, so we just log.
      await context.supabase.from("order_status_history").insert({
        order_id: data.id,
        from_status: curr?.status ?? null,
        to_status: data.status,
        changed_by: context.userId,
        note: data.note ?? "Auto-dispatched to Steadfast",
      } as any);
      return { ok: true };
    }

    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("order_status_history").insert({
      order_id: data.id,
      from_status: curr?.status ?? null,
      to_status: data.status,
      changed_by: context.userId,
      note: data.note ?? null,
    } as any);
    return { ok: true };
  });

// -------- ADMIN: internal note --------

export const addInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase.from("order_internal_notes").insert({
      order_id: data.id,
      author_user_id: context.userId,
      body: data.body,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- ADMIN: blocklist --------

export const addBlockedIdentifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["ip", "fingerprint", "phone"]),
        value: z.string().min(1).max(200),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase.from("blocked_identifiers").insert({
      kind: data.kind,
      value: data.value,
      reason: data.reason ?? null,
      blocked_by: context.userId,
    } as any);
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeBlockedIdentifier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("blocked_identifiers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBlockedIdentifiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("blocked_identifiers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const BlockItem = z.object({
  kind: z.enum(["ip", "fingerprint", "phone"]),
  value: z.string().min(1).max(200),
});

// Returns which of the supplied (kind,value) pairs are currently blocked.
export const getBlockStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ items: z.array(BlockItem).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const filter = data.items
      .map((c) => `and(kind.eq.${c.kind},value.eq."${c.value.replace(/"/g, '')}")`)
      .join(",");
    const { data: rows, error } = await context.supabase
      .from("blocked_identifiers")
      .select("id, kind, value, reason, created_at")
      .or(filter);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Atomic bulk block — upserts on (kind,value) so duplicates are safe.
export const bulkBlockIdentifiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z.array(BlockItem).min(1).max(20),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const rows = data.items.map((it) => ({
      kind: it.kind,
      value: it.value,
      reason: data.reason ?? null,
      blocked_by: context.userId,
    }));
    const { error } = await context.supabase
      .from("blocked_identifiers")
      .upsert(rows as any, { onConflict: "kind,value", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

// Atomic bulk unblock by (kind,value) pairs.
export const bulkUnblockIdentifiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ items: z.array(BlockItem).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    // Group deletes per-kind for a scalable IN() query on values.
    const byKind = new Map<string, string[]>();
    for (const it of data.items) {
      const arr = byKind.get(it.kind) ?? [];
      arr.push(it.value);
      byKind.set(it.kind, arr);
    }
    let total = 0;
    for (const [kind, values] of byKind) {
      const { error, count } = await context.supabase
        .from("blocked_identifiers")
        .delete({ count: "exact" })
        .eq("kind", kind)
        .in("value", values);
      if (error) throw new Error(error.message);
      total += count ?? 0;
    }
    return { ok: true, count: total };
  });

// -------- Simple product search for the "add product" combobox in the drawer --------

export const searchProductsForOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    let q = context.supabase
      .from("products")
      .select("id, title, price, sku, images, og_image_url, is_online_book")
      .eq("is_active", true)
      .limit(20);
    if (data.q && data.q.trim()) {
      const term = data.q.trim().replace(/[%,]/g, "");
      q = q.or(`title.ilike.%${term}%,sku.ilike.%${term}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      price: Number(r.price),
      sku: r.sku,
      image: r.og_image_url || (Array.isArray(r.images) ? r.images[0]?.url : null) || null,
      isOnlineBook: !!r.is_online_book,
    }));
  });

// -------- INCOMPLETE CHECKOUTS --------

function dhakaDayKey(d = new Date()): string {
  // YYYY-MM-DD in Asia/Dhaka
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA gives YYYY-MM-DD
}

function computeSignature(
  phone: string,
  items: Array<{ productId: string; quantity: number }>,
) {
  const sig = items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(",");
  return `${phone}|${dhakaDayKey()}|${sig}`;
}

export const CHECKOUT_OUTCOMES = [
  "abandoned",
  "pending",
  "cancelled",
  "failed",
  "timeout",
] as const;
export type CheckoutOutcome = (typeof CHECKOUT_OUTCOMES)[number];

const IncompleteInput = z.object({
  customer: z.object({
    name: z.string().max(120).optional().or(z.literal("")),
    phone: z.string().regex(/^01[3-9]\d{8}$/),
    email: z.string().max(200).optional().or(z.literal("")),
    division: z.string().max(80).optional().or(z.literal("")),
    district: z.string().max(80).optional().or(z.literal("")),
    upazila: z.string().max(80).optional().or(z.literal("")),
    address: z.string().max(300).optional().or(z.literal("")),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(80),
        title: z.string().max(200),
        unitPrice: z.number().nonnegative(),
        quantity: z.number().int().positive().max(999),
        image: z.string().max(500).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(50),
  totals: z.object({
    subtotal: z.number().nonnegative(),
    shipping: z.number().nonnegative(),
    total: z.number().nonnegative(),
  }),
  fingerprint: z.string().max(80).optional().or(z.literal("")),
  userId: z.string().uuid().optional().nullable(),
  outcome: z.enum(CHECKOUT_OUTCOMES).optional(),
  gatewayRef: z.string().max(120).optional().or(z.literal("")),
});

export const captureIncompleteCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) => IncompleteInput.parse(d))
  .handler(async ({ data }) => {
    const sb = serverPublic();
    let ip = "";
    let ua = "";
    try {
      ip = getRequestIP({ xForwardedFor: true }) || "";
      ua = getRequestHeader("user-agent") || "";
    } catch {}

    // Skip capture if this phone already has a confirmed order today (avoid noise) — unless
    // we're specifically recording a gateway outcome (cancelled/failed/timeout).
    if (!data.outcome || data.outcome === "abandoned") {
      const { data: existingOrder } = await sb
        .from("orders")
        .select("id")
        .eq("customer_phone", data.customer.phone)
        .limit(1);
      if (existingOrder && existingOrder.length) return { ok: true, skipped: true };
    }

    const signature = computeSignature(
      data.customer.phone,
      data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    );

    // Atomic upsert + attempt append via SECURITY DEFINER RPC.
    // The unique constraint on `signature` + ON CONFLICT DO UPDATE in the function
    // guarantees no duplicate rows even under concurrent requests.
    const { data: rowId, error } = await sb.rpc("record_incomplete_attempt", {
      _signature: signature,
      _user_id: data.userId ?? null,
      _customer_name: data.customer.name || "",
      _customer_phone: data.customer.phone,
      _customer_email: data.customer.email || "",
      _division: data.customer.division || "",
      _district: data.customer.district || "",
      _thana: data.customer.upazila || "",
      _address_line: data.customer.address || "",
      _cart: data.items as any,
      _subtotal: data.totals.subtotal,
      _shipping: data.totals.shipping,
      _total: data.totals.total,
      _ip: ip || "",
      _user_agent: ua || "",
      _fingerprint: data.fingerprint || "",
      _outcome: data.outcome || "abandoned",
      _gateway_ref: data.gatewayRef || "",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, id: rowId as unknown as string };
  });


export const listAdminIncompleteCheckouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).max(100000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;
    let q = context.supabase
      .from("incomplete_checkouts")
      .select("*", { count: "exact" })
      .order("last_attempt_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.search) {
      const s = data.search.trim();
      q = q.or(
        `customer_phone.ilike.%${s}%,customer_name.ilike.%${s}%,customer_email.ilike.%${s}%`,
      );
    }
    const { data: rows, error, count: total } = await q;
    if (error) throw new Error(error.message);
    const items = (rows ?? []).map((r: any) => ({
      ...r,
      last_ip: r.last_ip == null ? null : String(r.last_ip),
    }));
    return { items, total: total ?? items.length };
  });


export const deleteIncompleteCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("incomplete_checkouts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- ADMIN: promote an incomplete checkout into a real order --------
// The row moves from `incomplete_checkouts` into `orders` with status = "incomplete"
// so staff can view / edit it in the same drawer as any other order.
export const promoteIncompleteCheckoutToOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);

    const { data: row, error: readErr } = await context.supabase
      .from("incomplete_checkouts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (readErr || !row) throw new Error(readErr?.message || "Not found");

    // If an incomplete order already exists for this phone, reuse it.
    const { data: existing } = await context.supabase
      .from("orders")
      .select("id")
      .eq("customer_phone", row.customer_phone)
      .eq("status", "incomplete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      await context.supabase.from("incomplete_checkouts").delete().eq("id", data.id);
      return { id: existing.id as string };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin;

    const { data: orderNoRow, error: seqErr } = await sb.rpc("next_order_no");
    if (seqErr || !orderNoRow) throw new Error(seqErr?.message || "Failed to allocate order number");
    const orderNo = orderNoRow as unknown as string;

    const cart = Array.isArray(row.cart) ? (row.cart as any[]) : [];
    const hasPhysical = cart.some((i) => !i.isOnlineBook && i.type !== "ebook");
    const hasEbook = cart.some((i) => i.isOnlineBook || i.type === "ebook");
    const orderType: "physical" | "ebook" | "mixed" = hasPhysical && hasEbook
      ? "mixed"
      : hasPhysical
        ? "physical"
        : hasEbook
          ? "ebook"
          : "physical";

    const fullAddr = composeFullAddress({
      address_line: row.address_line || null,
      thana: row.thana || null,
      district: row.district || null,
      division: row.division || null,
    });
    const itemDesc = composeItemDescription(
      cart.map((i: any) => ({ title: String(i.title ?? ""), quantity: Number(i.quantity ?? 1) })),
    );

    const { data: order, error: insErr } = await sb
      .from("orders")
      .insert({
        order_no: orderNo,
        user_id: row.user_id ?? null,
        customer_name: row.customer_name || "(no name)",
        customer_phone: row.customer_phone,
        customer_email: row.customer_email || null,
        division: row.division || null,
        district: row.district || null,
        thana: row.thana || null,
        address_line: row.address_line || null,
        full_address: fullAddr || null,
        subtotal_bdt: Number(row.subtotal_bdt ?? 0),
        shipping_bdt: Number(row.shipping_bdt ?? 0),
        discount_bdt: 0,
        total_bdt: Number(row.total_bdt ?? 0),
        cod_amount: 0,
        payment_status: "pending",
        payment_method: null,
        status: "incomplete",
        order_type: orderType,
        has_physical: hasPhysical,
        delivery_type: 0,
        note: null,
        item_description: itemDesc,
        ip: row.last_ip || null,
        user_agent: row.last_user_agent || null,
        device_fingerprint: row.last_fingerprint || null,
        source: "website",
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    if (cart.length) {
      const isUuidStr = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const itemsRows = cart.map((i: any) => {
        const pid: string = String(i.productId ?? "");
        const isBundle = pid.startsWith("bundle:");
        const rawId = isBundle ? pid.slice(7) : pid;
        return {
          order_id: order.id,
          product_id: !isBundle && isUuidStr(rawId) ? rawId : null,
          bundle_id: isBundle && isUuidStr(rawId) ? rawId : null,
          is_bundle: isBundle,
          title: String(i.title ?? ""),
          unit_price: Number(i.unitPrice ?? 0),
          quantity: Number(i.quantity ?? 1),
          line_total: Number(i.unitPrice ?? 0) * Number(i.quantity ?? 1),
          image_url: i.image || null,
          item_type: i.isOnlineBook || i.type === "ebook" ? "ebook" : "physical",
        };
      });
      const { error: itemErr } = await sb.from("order_items").insert(itemsRows as any);
      if (itemErr) throw new Error(itemErr.message);
    }

    await context.supabase.from("incomplete_checkouts").delete().eq("id", data.id);

    return { id: order.id as string };
  });


// -------- PUBLIC blocklist check (used by the app-wide gate) --------

export const checkBlocklistPublic = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ fingerprint: z.string().max(80).optional().or(z.literal("")) }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverPublic();
    let ip = "";
    try {
      ip = getRequestIP({ xForwardedFor: true }) || "";
    } catch {}
    const checks: Array<{ kind: "ip" | "fingerprint"; value: string }> = [];
    if (ip) checks.push({ kind: "ip", value: ip });
    if (data.fingerprint) checks.push({ kind: "fingerprint", value: data.fingerprint });
    if (!checks.length) return { blocked: false as const };
    const { data: blocked } = await sb
      .from("blocked_identifiers")
      .select("kind,value,reason")
      .or(checks.map((c) => `and(kind.eq.${c.kind},value.eq.${c.value})`).join(","));
    if (blocked && blocked.length) {
      return { blocked: true as const, reason: blocked[0]?.reason ?? null };
    }
    return { blocked: false as const };
  });


// -------- ADMIN: retry ebook delivery for one order --------
export const retryEbookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("orders")
      .update({
        digital_status: "pending",
        digital_attempt_count: 0,
        digital_next_retry_at: null,
        digital_locked_until: null,
        digital_last_error: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    triggerEbookDelivery(data.id);
    return { ok: true };
  });

// -------- ADMIN: e-commerce dashboard stats --------

export type EcomDashboardRecentOrder = {
  id: string;
  order_no: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_bdt: number;
  status: string;
  created_at: string;
};

export type EcomDashboardStats = {
  today_sales_bdt: number;
  today_sales_delta_pct: number | null;
  pending_orders: number;
  pending_orders_new_today: number;
  products_in_stock: number;
  products_low_stock: number;
  conversion_rate_pct: number;
  conversion_rate_delta_pct: number | null;
  recent_orders: EcomDashboardRecentOrder[];
};

export const getEcommerceDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EcomDashboardStats> => {
    await ensureStaff(context);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const start30 = new Date(startOfToday);
    start30.setDate(start30.getDate() - 30);
    const start60 = new Date(startOfToday);
    start60.setDate(start60.getDate() - 60);

    const REVENUE_STATUSES = ["processing", "ready_to_ship", "shipped", "delivered"];

    const [
      todayRes,
      yestRes,
      pendingRes,
      pendingTodayRes,
      productsRes,
      recentRes,
      conv30OrdersRes,
      conv30IncompleteRes,
      conv60OrdersRes,
      conv60IncompleteRes,
    ] = await Promise.all([
      context.supabase
        .from("orders")
        .select("total_bdt")
        .in("status", REVENUE_STATUSES)
        .gte("created_at", startOfToday.toISOString()),
      context.supabase
        .from("orders")
        .select("total_bdt")
        .in("status", REVENUE_STATUSES)
        .gte("created_at", startOfYesterday.toISOString())
        .lt("created_at", startOfToday.toISOString()),
      context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["processing", "ready_to_ship", "hold"]),
      context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["processing", "ready_to_ship", "hold"])
        .gte("created_at", startOfToday.toISOString()),
      context.supabase.from("products").select("stock").eq("is_active", true),
      context.supabase
        .from("orders")
        .select("id, order_no, customer_name, customer_phone, total_bdt, status, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", REVENUE_STATUSES)
        .gte("created_at", start30.toISOString()),
      context.supabase
        .from("incomplete_checkouts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start30.toISOString()),
      context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", REVENUE_STATUSES)
        .gte("created_at", start60.toISOString())
        .lt("created_at", start30.toISOString()),
      context.supabase
        .from("incomplete_checkouts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start60.toISOString())
        .lt("created_at", start30.toISOString()),
    ]);

    const sum = (rows: any[] | null | undefined) =>
      (rows ?? []).reduce((a, r) => a + Number(r?.total_bdt ?? 0), 0);
    const today_sales = sum(todayRes.data);
    const yest_sales = sum(yestRes.data);
    const today_delta =
      yest_sales > 0 ? ((today_sales - yest_sales) / yest_sales) * 100 : today_sales > 0 ? 100 : null;

    const stockRows = (productsRes.data ?? []) as Array<{ stock: number | null }>;
    const products_in_stock = stockRows.filter((p) => (p.stock ?? 0) > 0).length;
    const products_low_stock = stockRows.filter(
      (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5,
    ).length;

    const conv30Orders = conv30OrdersRes.count ?? 0;
    const conv30Incomp = conv30IncompleteRes.count ?? 0;
    const conv30Total = conv30Orders + conv30Incomp;
    const conv30 = conv30Total > 0 ? (conv30Orders / conv30Total) * 100 : 0;

    const conv60Orders = conv60OrdersRes.count ?? 0;
    const conv60Incomp = conv60IncompleteRes.count ?? 0;
    const conv60Total = conv60Orders + conv60Incomp;
    const conv60 = conv60Total > 0 ? (conv60Orders / conv60Total) * 100 : 0;
    const conv_delta = conv60Total > 0 ? conv30 - conv60 : null;

    return {
      today_sales_bdt: today_sales,
      today_sales_delta_pct: today_delta,
      pending_orders: pendingRes.count ?? 0,
      pending_orders_new_today: pendingTodayRes.count ?? 0,
      products_in_stock,
      products_low_stock,
      conversion_rate_pct: conv30,
      conversion_rate_delta_pct: conv_delta,
      recent_orders: (recentRes.data ?? []) as EcomDashboardRecentOrder[],
    };
  });

