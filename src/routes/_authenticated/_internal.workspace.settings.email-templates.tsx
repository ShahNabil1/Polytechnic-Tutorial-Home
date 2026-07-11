import { createFileRoute } from "@tanstack/react-router";
import { EmailTemplatesManager } from "@/components/internal/EmailTemplatesManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/email-templates")({
  head: () => ({
    meta: [
      { title: "Email Templates — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <EmailTemplatesManager />,
});
