import { createFileRoute } from "@tanstack/react-router";
import { SeoEditor } from "@/components/internal/cms/SeoEditor";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/seo")({
  head: () => ({ meta: [{ title: "SEO Manager — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => <SeoEditor />,
});
