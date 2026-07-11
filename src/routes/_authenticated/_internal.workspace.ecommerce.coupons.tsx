import { createFileRoute } from "@tanstack/react-router";
import { AdminCouponsManager } from "@/components/internal/AdminCouponsManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/coupons")({
  head: () => ({
    meta: [{ title: "Coupons — Workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCouponsManager,
});
