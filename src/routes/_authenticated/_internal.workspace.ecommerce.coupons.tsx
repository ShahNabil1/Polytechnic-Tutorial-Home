import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/internal/PlaceholderPage";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <PlaceholderPage
      section="E-Commerce"
      title="Coupons"
      description="Create promotional codes and discounts to drive sales."
      icon={Ticket}
    />
  ),
});
