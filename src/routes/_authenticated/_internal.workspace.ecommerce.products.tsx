import { createFileRoute } from "@tanstack/react-router";
import { AdminProductsManager } from "@/components/internal/AdminProductsManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/products")({
  head: () => ({
    meta: [{ title: "Products — Workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminProductsManager,
});
