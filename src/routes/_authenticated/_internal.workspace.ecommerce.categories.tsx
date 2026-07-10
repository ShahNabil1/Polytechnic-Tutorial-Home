import { createFileRoute } from "@tanstack/react-router";
import { AdminCategoriesManager } from "@/components/internal/AdminCategoriesManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/categories")({
  head: () => ({
    meta: [{ title: "Categories — Workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminCategoriesManager,
});
