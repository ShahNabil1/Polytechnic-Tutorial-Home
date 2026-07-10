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
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateOrderInput.parse(d))
  .handler(async ({ data }) => {
    const sb = serverPublic();
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
        subtotal_bdt: data.totals.subtotal,
        shipping_bdt: data.totals.shipping,
        discount_bdt: data.totals.discount ?? 0,
        total_bdt: data.totals.total,
        cod_amount: 0,
        payment_status: "paid",
        payment_method: "paystation_test",
        status: "processing",
        order_type: orderType,
        has_physical: hasPhysical,
        delivery_type: 0,
        note: data.customer.note || null,
        item_description: itemDesc,
        ip: ip || null,
        user_agent: ua || null,
        device_fingerprint: data.fingerprint || null,
        idempotency_key: data.idempotencyKey,
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

    const itemsRows = data.items.map((i) => ({
      order_id: order.id,
      product_id: i.isBundle ? null : (isUuid(i.productId) ? i.productId : null),
      bundle_id: i.isBundle && isUuid(i.productId.replace(/^bundle:/, "")) ? i.productId.replace(/^bundle:/, "") : null,
      is_bundle: !!i.isBundle,
      title: i.title,
      unit_price: i.unitPrice,
      quantity: i.quantity,
      line_total: i.unitPrice * i.quantity,
      image_url: i.image || null,
      item_type: i.isOnlineBook || i.type === "ebook" ? "ebook" : "physical",
    }));
    const { error: itemErr } = await sb.from("order_items").insert(itemsRows as any);
    if (itemErr) throw new Error(itemErr.message);

    // On successful order: remove any incomplete-checkout rows for this phone.
    await sb.from("incomplete_checkouts").delete().eq("customer_phone", data.customer.phone);

    return { id: order.id, orderNo: order.order_no, status: order.status };
  });


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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    let q = context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.trim();
      q = q.or(
        `order_no.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // counts per status
    const { data: countsRaw } = await context.supabase
      .from("orders")
      .select("status");
    const counts: Record<string, number> = {};
    for (const r of countsRaw ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;

    const orders = (rows ?? []).map((r: any) => ({ ...r, ip: r.ip == null ? null : String(r.ip) }));
    return { orders, counts };
  });

// -------- ADMIN: get one order --------

export const getAdminOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const [{ data: order, error: oe }, { data: items }, { data: notes }, { data: history }] =
      await Promise.all([
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
    return { order: orderOut, items: items ?? [], notes: notes ?? [], history: history ?? [], profile };
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
      .select("status")
      .eq("id", data.id)
      .single();
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
    if (data.q && data.q.trim()) q = q.ilike("title", `%${data.q.trim()}%`);
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
    z.object({ search: z.string().max(120).optional(), limit: z.number().int().min(1).max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    let q = context.supabase
      .from("incomplete_checkouts")
      .select("*")
      .order("last_attempt_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.search) {
      const s = data.search.trim();
      q = q.or(
        `customer_phone.ilike.%${s}%,customer_name.ilike.%${s}%,customer_email.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      last_ip: r.last_ip == null ? null : String(r.last_ip),
    }));
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

