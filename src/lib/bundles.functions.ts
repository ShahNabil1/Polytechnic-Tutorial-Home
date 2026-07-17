import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProductImage } from "@/lib/products";

function serverPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureCanManage(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_products",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: manage_products required");
}

function randomBundleSku() {
  return `PTH-BDL-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export type BundleItemRef = {
  productId: string;
  slug: string;
  title: string;
  price: number;
  quantity: number;
  type: "physical" | "ebook" | "suggestion";
  image?: string | null;
  isOnlineBook: boolean;
};

export type Bundle = {
  id: string;
  slug: string;
  sku: string;
  title: string;
  subtitle: string | null;
  description: string;
  price: number;
  originalPrice: number | null; // stored compare_price OR computed from items sum
  images: ProductImage[];
  ogImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  isFeatured: boolean;
  items: BundleItemRef[];
  hasPhysical: boolean;
  hasDigital: boolean;
  updatedAt: string;
};

function mapBundle(row: any, items: BundleItemRef[]): Bundle {
  const itemsSum = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasPhysical = items.some((i) => i.type === "physical" && !i.isOnlineBook);
  const hasDigital = items.some((i) => i.type !== "physical" || i.isOnlineBook);
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    title: row.title,
    subtitle: row.subtitle ?? null,
    description: row.description ?? "",
    price: Number(row.price),
    originalPrice: row.compare_price != null ? Number(row.compare_price) : itemsSum || null,
    images: Array.isArray(row.images) ? (row.images as ProductImage[]) : [],
    ogImage: row.og_image_url ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    items,
    hasPhysical,
    hasDigital,
    updatedAt: row.updated_at,
  };
}

async function fetchItemsFor(client: any, bundleIds: string[]): Promise<Map<string, BundleItemRef[]>> {
  const map = new Map<string, BundleItemRef[]>();
  if (bundleIds.length === 0) return map;
  const { data, error } = await client
    .from("product_bundle_items")
    .select(
      "bundle_id, quantity, sort_order, product:products(id, slug, title, price, is_online_book, og_image_url, images, product_type:product_categories!products_product_type_id_fkey(slug))",
    )
    .in("bundle_id", bundleIds)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as any[]) {
    const p = row.product;
    if (!p) continue;
    const image = p.og_image_url ?? (Array.isArray(p.images) && p.images[0]?.url) ?? null;
    const arr = map.get(row.bundle_id) ?? [];
    arr.push({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      price: Number(p.price),
      quantity: row.quantity,
      type: (p.product_type?.slug as any) ?? "physical",
      image,
      isOnlineBook: !!p.is_online_book,
    });
    map.set(row.bundle_id, arr);
  }
  return map;
}

// ============ Public (Redis cached, invalidated on admin write) ============

const BUNDLE_TTL = 10 * 60; // 10 min

async function invalidateBundleCaches() {
  const { cacheDelPrefix } = await import("./cache.server");
  await cacheDelPrefix("bundles:");
}

export const listPublicBundles = createServerFn({ method: "GET" }).handler(async () => {
  const { withCache } = await import("./cache.server");
  return withCache<Bundle[]>("bundles:list:public", BUNDLE_TTL, async () => {
    const client = serverPublic();
    const { data: rows, error } = await client
      .from("product_bundles")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const itemsMap = await fetchItemsFor(client, ids);
    return (rows ?? []).map((r) => mapBundle(r, itemsMap.get(r.id) ?? []));
  });
});

export const getPublicBundleBySlug = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const { withCache } = await import("./cache.server");
    return withCache<Bundle | null>(`bundles:slug:${data.slug}`, BUNDLE_TTL, async () => {
      const client = serverPublic();
      const { data: row, error } = await client
        .from("product_bundles")
        .select("*")
        .eq("slug", data.slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      const itemsMap = await fetchItemsFor(client, [row.id]);
      return mapBundle(row, itemsMap.get(row.id) ?? []);
    });
  });

// ============ Admin ============

export const listAdminBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManage(context);
    const { data: rows, error } = await context.supabase
      .from("product_bundles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id);
    const itemsMap = await fetchItemsFor(context.supabase, ids);
    return (rows ?? []).map((r: any) => mapBundle(r, itemsMap.get(r.id) ?? []));
  });

const BundleItemInput = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
});

const BundleUpsertInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/i, "slug: lowercase letters, numbers or -"),
  sku: z.string().trim().max(60).optional().nullable(),
  title: z.string().trim().min(1).max(250),
  subtitle: z.string().trim().max(250).optional().nullable(),
  description: z.string().max(20000).default(""),
  price: z.number().nonnegative().max(1_000_000),
  compare_price: z.number().nonnegative().max(1_000_000).optional().nullable(),
  images: z.array(z.object({ url: z.string().url(), key: z.string().optional() })).max(5).default([]),
  og_image_url: z.string().url().optional().nullable(),
  meta_title: z.string().trim().max(250).optional().nullable(),
  meta_description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  items: z.array(BundleItemInput).min(2, "A bundle must include at least 2 products").max(20),
});

export const upsertBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BundleUpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { items, id, sku, ...rest } = data;
    const finalSku = (sku ?? "").trim() || randomBundleSku();
    const payload = {
      ...rest,
      sku: finalSku,
      images: rest.images as never,
      created_by: id ? undefined : context.userId,
    };
    let bundleId = id;
    if (id) {
      const { error } = await context.supabase
        .from("product_bundles")
        .update(payload as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("product_bundles")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      bundleId = (row as any).id;
    }
    await context.supabase.from("product_bundle_items").delete().eq("bundle_id", bundleId!);
    const rows = items.map((it, idx) => ({
      bundle_id: bundleId!,
      product_id: it.product_id,
      quantity: it.quantity,
      sort_order: idx,
    }));
    const { error: insErr } = await context.supabase
      .from("product_bundle_items")
      .insert(rows as never);
    if (insErr) throw new Error(insErr.message);
    await invalidateBundleCaches();
    return { ok: true, id: bundleId };
  });

export const deleteBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase
      .from("product_bundles")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await invalidateBundleCaches();
    return { ok: true };
  });
