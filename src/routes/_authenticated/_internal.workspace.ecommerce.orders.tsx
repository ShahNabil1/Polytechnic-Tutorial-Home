import { createFileRoute } from "@tanstack/react-router";
import { AdminOrdersManager } from "@/components/internal/AdminOrdersManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/ecommerce/orders")({
  head: () => ({ meta: [{ title: "Orders — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => <AdminOrdersManager />,
});
