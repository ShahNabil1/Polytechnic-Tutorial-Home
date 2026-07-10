import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/account/ProfilePage";

export const Route = createFileRoute("/_authenticated/sdash/profile")({
  component: () => <ProfilePage role="student" />,
});
