import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InternalShell, INSTRUCTOR_NAV } from "@/components/internal/InternalShell";

export const Route = createFileRoute("/_authenticated/_internal/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InstructorLayout,
});

function InstructorLayout() {
  return (
    <InternalShell brand="Instructor" subtitle="Teaching Console" nav={INSTRUCTOR_NAV} profileTo="/instructor/profile">
      <Outlet />
    </InternalShell>
  );
}
