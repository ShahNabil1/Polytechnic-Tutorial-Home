import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/internal/PlaceholderPage";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/products")({
  head: () => ({ meta: [{ title: "Products — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PlaceholderPage
      section="E-Commerce"
      title="Products"
      description="Add, edit and organize the catalogue that powers your storefront."
      icon={Package}
    />
  ),
});
