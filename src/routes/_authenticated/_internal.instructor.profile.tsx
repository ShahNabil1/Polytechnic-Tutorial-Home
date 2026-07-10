import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/account/ProfilePage";

export const Route = createFileRoute("/_authenticated/_internal/instructor/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Instructor" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ProfilePage role="instructor" />,
});
