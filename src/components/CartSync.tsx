/**
 * Persists the signed-in user's cart to public.user_carts whenever it
 * changes. Renders nothing. Mounted once from RootComponent (non-internal).
 */
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart-store";
import { upsertMyCart } from "@/lib/crm-cart.functions";

export function CartSync() {
  const items = useCart((s) => s.items);
  const upsert = useServerFn(upsertMyCart);
  const userIdRef = useRef<string | null>(null);
  const lastSyncedRef = useRef<string>("");

  // Track auth state
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      userIdRef.current = data.user?.id ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      userIdRef.current = session?.user?.id ?? null;
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Sync cart on change (debounced)
  useEffect(() => {
    if (!userIdRef.current) return;
    const payload = items.map((i) => ({
      productId: i.productId,
      slug: i.slug,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
      ...(i.image ? { image: i.image } : {}),
      ...(i.type ? { type: i.type } : {}),
      ...(i.isBundle ? { isBundle: i.isBundle } : {}),
    }));
    const sig = JSON.stringify(payload);
    if (sig === lastSyncedRef.current) return;
    const timer = setTimeout(() => {
      lastSyncedRef.current = sig;
      upsert({ data: { items: payload } }).catch(() => {
        lastSyncedRef.current = ""; // allow retry on next change
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [items, upsert]);

  return null;
}
