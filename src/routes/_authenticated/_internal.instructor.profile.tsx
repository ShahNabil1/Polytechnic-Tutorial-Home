import { createFileRoute } from "@tanstack/react-router";
import { InternalProfilePage } from "@/components/internal/InternalProfilePage";

export const Route = createFileRoute("/_authenticated/_internal/instructor/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Instructor" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <InternalProfilePage role="instructor" />,
});
