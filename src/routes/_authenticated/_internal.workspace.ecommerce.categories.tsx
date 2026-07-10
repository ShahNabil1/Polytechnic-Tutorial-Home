import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/internal/PlaceholderPage";
import { Tags } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/categories")({
  head: () => ({ meta: [{ title: "Categories — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PlaceholderPage
      section="E-Commerce"
      title="Categories"
      description="Group products into browsable collections your customers can navigate."
      icon={Tags}
    />
  ),
});
