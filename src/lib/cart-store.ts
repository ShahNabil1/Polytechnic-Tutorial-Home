import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./products";

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  price: number;
  type: Product["type"];
  coverColor: string;
  coverEmoji: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === product.id);
          if (existing) {
            // Digital items → max 1
            const isDigital = product.type !== "physical";
            const nextQty = isDigital ? 1 : existing.quantity + qty;
            return {
              items: state.items.map((i) =>
                i.productId === product.id ? { ...i, quantity: nextQty } : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                type: product.type,
                coverColor: product.coverColor,
                coverEmoji: product.coverEmoji,
                quantity: product.type === "physical" ? qty : 1,
              },
            ],
          };
        }),
      remove: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),
      setQty: (productId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.productId === productId
                ? { ...i, quantity: Math.max(1, qty) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "poly-edu-cart" },
  ),
);

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function hasPhysical(items: CartItem[]) {
  return items.some((i) => i.type === "physical");
}

export function calcShipping(items: CartItem[], city: string) {
  if (!hasPhysical(items)) return 0;
  const inDhaka = city.trim().toLowerCase().includes("dhaka") ||
    city.trim().includes("ঢাকা");
  return inDhaka ? 60 : 130;
}
