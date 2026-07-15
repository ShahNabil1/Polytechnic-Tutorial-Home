/**
 * CRM: read a signed-in customer's currently-active cart snapshot.
 * Cart items are written by the client cart-store sync hook.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CrmCartItem = {
  productId: string;
  slug?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  type?: string;
  isBundle?: boolean;
};

export type CrmUserCart = {
  user_id: string;
  items: CrmCartItem[];
  subtotal_bdt: number;
  item_count: number;
  updated_at: string | null;
};

async function ensureStaff(context: { supabase: any; userId: string }) {
  const { data: canManage } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _permission: "manage_users",
  });
  if (!canManage) throw new Error("Forbidden");
}

export const getCrmUserCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CrmUserCart | null> => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_carts")
      .select("user_id, items, subtotal_bdt, item_count, updated_at")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const r: any = row;
    return {
      user_id: r.user_id,
      items: Array.isArray(r.items) ? (r.items as CrmCartItem[]) : [],
      subtotal_bdt: Number(r.subtotal_bdt ?? 0),
      item_count: Number(r.item_count ?? 0),
      updated_at: r.updated_at,
    };
  });

// Client-callable: signed-in user writes their own cart snapshot.
// RLS on user_carts restricts to auth.uid() = user_id.
export const upsertMyCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        items: z
          .array(
            z.object({
              productId: z.string().max(120),
              slug: z.string().max(200).optional(),
              title: z.string().max(300),
              price: z.number(),
              quantity: z.number().int().min(0),
              image: z.string().max(600).optional(),
              type: z.string().max(30).optional(),
              isBundle: z.boolean().optional(),
            }),
          )
          .max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const items = data.items;
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const { error } = await context.supabase.from("user_carts").upsert(
      {
        user_id: context.userId,
        items,
        subtotal_bdt: subtotal,
        item_count: count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
