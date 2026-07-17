import { createFileRoute } from "@tanstack/react-router";
import { HomepageEditor } from "@/components/internal/cms/HomepageEditor";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/homepage")({
  head: () => ({ meta: [{ title: "Homepage CMS — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => <HomepageEditor />,
});
