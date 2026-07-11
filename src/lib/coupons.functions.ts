import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type CouponScope = "shop" | "course" | "special";
export type CouponAppliesTo = "all" | "products" | "categories" | "courses" | "customers";
export type CouponDiscountType = "percent" | "flat";
export type CouponTargetType = "product" | "category" | "course" | "customer";

export type CouponRow = {
  id: string;
  scope: CouponScope;
  code: string;
  name: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  cap_amount: number | null;
  min_spend: number;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  applies_to: CouponAppliesTo;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  stackable: boolean;
  exclude_shipping: boolean;
  uses_count: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  targets: { target_type: CouponTargetType; target_id: string }[];
};

// ---------- LIST ----------
export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ scope: z.enum(["shop", "course", "special"]).default("shop") })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CouponRow[]> => {
    await ensureStaff(context);
    const { data: rows, error } = await context.supabase
      .from("coupons")
      .select("*, coupon_targets(target_type, target_id)")
      .eq("scope", data.scope)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      discount_value: Number(r.discount_value),
      cap_amount: r.cap_amount == null ? null : Number(r.cap_amount),
      min_spend: Number(r.min_spend),
      targets: r.coupon_targets ?? [],
    })) as CouponRow[];
  });

// ---------- UPSERT ----------
const UpsertInput = z.object({
  id: z.string().uuid().optional().nullable(),
  scope: z.enum(["shop", "course", "special"]),
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, - and _"),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  discount_type: z.enum(["percent", "flat"]),
  discount_value: z.number().positive(),
  cap_amount: z.number().positive().optional().nullable(),
  min_spend: z.number().nonnegative().default(0),
  max_uses_total: z.number().int().positive().optional().nullable(),
  max_uses_per_customer: z.number().int().positive().optional().nullable(),
  applies_to: z.enum(["all", "products", "categories", "courses", "customers"]),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  stackable: z.boolean().default(false),
  exclude_shipping: z.boolean().default(true),
  targets: z
    .array(
      z.object({
        target_type: z.enum(["product", "category", "course", "customer"]),
        target_id: z.string().uuid(),
      }),
    )
    .default([]),
});

export const upsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const payload = {
      scope: data.scope,
      code: data.code.trim(),
      name: data.name.trim(),
      description: data.description || null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      cap_amount: data.cap_amount ?? null,
      min_spend: data.min_spend ?? 0,
      max_uses_total: data.max_uses_total ?? null,
      max_uses_per_customer: data.max_uses_per_customer ?? null,
      applies_to: data.applies_to,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      is_active: data.is_active,
      stackable: data.stackable,
      exclude_shipping: data.exclude_shipping,
    };

    let couponId = data.id ?? null;
    if (couponId) {
      const { error } = await context.supabase
        .from("coupons")
        .update(payload as never)
        .eq("id", couponId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("coupons")
        .insert({ ...payload, created_by: context.userId } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      couponId = (row as any).id as string;
    }

    // Replace targets
    await context.supabase.from("coupon_targets").delete().eq("coupon_id", couponId);
    if (data.applies_to !== "all" && data.targets.length) {
      const rows = data.targets.map((t) => ({
        coupon_id: couponId!,
        target_type: t.target_type,
        target_id: t.target_id,
      }));
      const { error: tErr } = await context.supabase
        .from("coupon_targets")
        .insert(rows as never);
      if (tErr) throw new Error(tErr.message);
    }
    return { id: couponId! };
  });

// ---------- TOGGLE / DELETE / REACTIVATE ----------
export const toggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("coupons")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const softDeleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("coupons")
      .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactivateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("coupons")
      .update({ deleted_at: null, is_active: true } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- VALIDATE (public) ----------
const ValidateInput = z.object({
  code: z.string().trim().min(1).max(60),
  subtotal: z.number().nonnegative(),
  productIds: z.array(z.string()).default([]),
  phone: z.string().optional().nullable(),
  scope: z.enum(["shop", "course", "special"]).default("shop"),
});

export type ValidateCouponResult = {
  ok: boolean;
  discount: number;
  couponId: string | null;
  code: string | null;
  name: string | null;
  discountType: CouponDiscountType | null;
  reason: string | null;
  minSpend?: number;
};

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ValidateInput.parse(d))
  .handler(async ({ data }): Promise<ValidateCouponResult> => {
    const sb = serverPublic();
    // Only pass UUID productIds; ignore bundle: prefixed
    const productIds = data.productIds.filter((p) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p),
    );
    // Resolve category ids from products
    let categoryIds: string[] = [];
    if (productIds.length) {
      const { data: subs } = await sb
        .from("product_subcategories")
        .select("category_id")
        .in("product_id", productIds);
      categoryIds = Array.from(new Set((subs ?? []).map((s: any) => s.category_id)));
    }
    const { data: res, error } = await sb.rpc("validate_coupon", {
      _code: data.code,
      _subtotal: data.subtotal,
      _product_ids: productIds,
      _category_ids: categoryIds,
      _phone: data.phone || null,
      _user_id: null,
      _scope: data.scope,
    } as any);
    if (error) {
      return { ok: false, discount: 0, couponId: null, code: null, name: null, discountType: null, reason: "error" };
    }
    const r = (res ?? {}) as any;
    return {
      ok: !!r.ok,
      discount: Number(r.discount ?? 0),
      couponId: r.coupon_id ?? null,
      code: r.code ?? null,
      name: r.name ?? null,
      discountType: (r.discount_type ?? null) as CouponDiscountType | null,
      reason: r.reason ?? null,
      minSpend: r.min_spend != null ? Number(r.min_spend) : undefined,
    };
  });

// ---------- Lookup helpers for admin form ----------
export const listProductsForCoupon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("products")
      .select("id, title, slug")
      .order("title");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; title: string; slug: string }[];
  });

export const listCategoriesForCoupon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("product_categories")
      .select("id, name, kind, slug")
      .order("kind")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; kind: string; slug: string }[];
  });
