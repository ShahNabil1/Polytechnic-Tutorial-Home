import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Product, ProductImage, ProductType } from "@/lib/products";

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

export type CategoryRow = {
  id: string;
  kind: "product_type" | "department" | "semester";
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function mapProduct(row: any, subs: { slug: string; kind: string }[]): Product {
  const departments = subs.filter((s) => s.kind === "department").map((s) => s.slug);
  const semesters = subs
    .filter((s) => s.kind === "semester")
    .map((s) => Number(s.slug))
    .filter((n) => !Number.isNaN(n));
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? null,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description ?? "",
    type: (row.product_type?.slug as ProductType) ?? "physical",
    price: Number(row.price),
    originalPrice: row.compare_price != null ? Number(row.compare_price) : null,
    images: Array.isArray(row.images) ? (row.images as ProductImage[]) : [],
    ogImage: row.og_image_url ?? null,
    metaTitle: row.meta_title ?? null,
    metaDescription: row.meta_description ?? null,
    departments,
    semesters,
    stock: row.stock,
    featured: row.is_featured,
    isActive: row.is_active,
    isOnlineBook: row.is_online_book ?? false,
    ebookFileUrl: row.ebook_file_url ?? null,
  };
}

function randomSku(prefix = "PTH") {
  const s = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${s}`;
}

async function fetchProductsWithSubs(client: ReturnType<typeof serverPublic>, filter?: (q: any) => any) {
  let q = client
    .from("products")
    .select("*, product_type:product_categories!products_product_type_id_fkey(slug,name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (filter) q = filter(q);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [] as Product[];
  const ids = rows.map((r: any) => r.id);
  const { data: subs, error: subErr } = await client
    .from("product_subcategories")
    .select("product_id, category:product_categories!product_subcategories_category_id_fkey(slug,kind)")
    .in("product_id", ids);
  if (subErr) throw new Error(subErr.message);
  const byProduct = new Map<string, { slug: string; kind: string }[]>();
  for (const s of subs ?? []) {
    const arr = byProduct.get((s as any).product_id) ?? [];
    arr.push({ slug: (s as any).category.slug, kind: (s as any).category.kind });
    byProduct.set((s as any).product_id, arr);
  }
  return rows.map((r: any) => mapProduct(r, byProduct.get(r.id) ?? []));
}

// ============ Public reads ============

export const listPublicProducts = createServerFn({ method: "GET" }).handler(async () => {
  return await fetchProductsWithSubs(serverPublic());
});

export const listFeaturedProducts = createServerFn({ method: "GET" }).handler(async () => {
  const client = serverPublic();
  return await fetchProductsWithSubs(client, (q) => q.eq("is_featured", true).limit(8));
});

export const getPublicProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const client = serverPublic();
    const { data: row, error } = await client
      .from("products")
      .select("*, product_type:product_categories!products_product_type_id_fkey(slug,name)")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { data: subs } = await client
      .from("product_subcategories")
      .select("category:product_categories!product_subcategories_category_id_fkey(slug,kind)")
      .eq("product_id", (row as any).id);
    const subsMapped = (subs ?? []).map((s: any) => ({ slug: s.category.slug, kind: s.category.kind }));
    return mapProduct(row, subsMapped);
  });

export const listPublicCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await serverPublic()
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .order("kind")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryRow[];
});

// ============ Admin: categories ============

export const listAllCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManage(context);
    const { data, error } = await context.supabase
      .from("product_categories")
      .select("*")
      .order("kind")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as CategoryRow[];
  });

const CategoryInput = z.object({
  kind: z.enum(["product_type", "department", "semester"]),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-_]+$/i, "slug: letters, numbers, - or _"),
  name: z.string().trim().min(1).max(120),
  sort_order: z.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CategoryInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { data: row, error } = await context.supabase
      .from("product_categories")
      .insert(data as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CategoryRow;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), patch: CategoryInput.partial() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase
      .from("product_categories")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("product_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Admin: products ============

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureCanManage(context);
    const { data: rows, error } = await context.supabase
      .from("products")
      .select("*, product_type:product_categories!products_product_type_id_fkey(slug,name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [] as Product[];
    const ids = rows.map((r: any) => r.id);
    const { data: subs } = await context.supabase
      .from("product_subcategories")
      .select("product_id, category:product_categories!product_subcategories_category_id_fkey(slug,kind)")
      .in("product_id", ids);
    const byProduct = new Map<string, { slug: string; kind: string }[]>();
    for (const s of subs ?? []) {
      const arr = byProduct.get((s as any).product_id) ?? [];
      arr.push({ slug: (s as any).category.slug, kind: (s as any).category.kind });
      byProduct.set((s as any).product_id, arr);
    }
    return rows.map((r: any) => mapProduct(r, byProduct.get(r.id) ?? []));
  });

const ImageSchema = z.object({ url: z.string().url(), key: z.string().optional() });

const ProductUpsertInput = z.object({
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
  product_type_id: z.string().uuid(),
  subcategory_ids: z.array(z.string().uuid()).max(50).default([]),
  images: z.array(ImageSchema).max(5).default([]),
  og_image_url: z.string().url().optional().nullable(),
  meta_title: z.string().trim().max(250).optional().nullable(),
  meta_description: z.string().trim().max(500).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional().nullable(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  is_online_book: z.boolean().default(false),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProductUpsertInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { subcategory_ids, id, sku, ...rest } = data;
    const finalSku = (sku ?? "").trim() || randomSku();
    const payload = {
      ...rest,
      sku: finalSku,
      images: rest.images as never,
      created_by: id ? undefined : context.userId,
    };
    let productId = id;
    if (id) {
      const { error } = await context.supabase.from("products").update(payload as never).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("products")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      productId = (row as any).id;
    }
    // Reset subcategories
    await context.supabase.from("product_subcategories").delete().eq("product_id", productId!);
    if (subcategory_ids.length > 0) {
      const rows = subcategory_ids.map((cid) => ({ product_id: productId!, category_id: cid }));
      const { error: insErr } = await context.supabase
        .from("product_subcategories")
        .insert(rows as never);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true, id: productId };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
