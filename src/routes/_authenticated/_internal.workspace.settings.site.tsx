import { createFileRoute } from "@tanstack/react-router";
import { SiteSettingsEditor } from "@/components/internal/cms/SiteSettingsEditor";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/site")({
  head: () => ({ meta: [{ title: "Site Settings — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: () => <SiteSettingsEditor />,
});
