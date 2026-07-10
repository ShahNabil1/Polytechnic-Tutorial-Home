import { create } from "zustand";

interface CartDrawerState {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useCartDrawer = create<CartDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openDrawer: () => set({ open: true }),
  closeDrawer: () => set({ open: false }),
}));
