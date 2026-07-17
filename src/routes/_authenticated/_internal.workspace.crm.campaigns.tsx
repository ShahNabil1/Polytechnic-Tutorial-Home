import { createFileRoute } from "@tanstack/react-router";
import { CrmCampaignsPanel } from "@/components/internal/crm/CrmCampaignsPanel";

export const Route = createFileRoute("/_authenticated/_internal/workspace/crm/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — CRM" }, { name: "robots", content: "noindex" }] }),
  component: CrmCampaignsPanel,
});
