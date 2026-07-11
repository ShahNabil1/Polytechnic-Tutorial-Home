import { createFileRoute } from "@tanstack/react-router";
import { SmsTemplatesManager } from "@/components/internal/SmsTemplatesManager";

export const Route = createFileRoute("/_authenticated/_internal/workspace/settings/sms-templates")({
  head: () => ({
    meta: [
      { title: "SMS Templates — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <SmsTemplatesManager />,
});
