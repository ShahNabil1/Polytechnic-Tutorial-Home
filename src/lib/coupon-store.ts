import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppliedCoupon = {
  code: string;
  name: string;
  discount: number;
  couponId: string;
  discountType: "percent" | "flat";
};

interface CouponState {
  applied: AppliedCoupon | null;
  set: (c: AppliedCoupon | null) => void;
  clear: () => void;
}

export const useCoupon = create<CouponState>()(
  persist(
    (set) => ({
      applied: null,
      set: (c) => set({ applied: c }),
      clear: () => set({ applied: null }),
    }),
    { name: "poly-edu-coupon" },
  ),
);
