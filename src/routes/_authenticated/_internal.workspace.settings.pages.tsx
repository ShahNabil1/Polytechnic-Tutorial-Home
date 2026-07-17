import { createFileRoute } from "@tanstack/react-router";
import { StaticPagesEditor } from "@/components/internal/cms/StaticPagesEditor";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/pages")({
  head: () => ({ meta: [{ title: "Static Pages — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => <StaticPagesEditor />,
});
