import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/internal/PlaceholderPage";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/orders")({
  head: () => ({ meta: [{ title: "Orders — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PlaceholderPage
      section="E-Commerce"
      title="Orders"
      description="Track, fulfill and manage every order placed through your storefront."
      icon={ShoppingBag}
    />
  ),
});
