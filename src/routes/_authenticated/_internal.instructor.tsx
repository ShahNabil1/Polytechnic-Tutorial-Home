import { createFileRoute, Outlet } from "@tanstack/react-router";
import { InternalShell, INSTRUCTOR_NAV } from "@/components/internal/InternalShell";

export const Route = createFileRoute("/_authenticated/_internal/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor — Polytechnic Tutorial" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery({
      queryKey: ["me", "profile"],
      queryFn: async () => {
        const { getMyProfile } = await import("@/lib/profile.functions");
        return getMyProfile(undefined as never);
      },
      staleTime: 10 * 60_000,
    });
  },
  component: InstructorLayout,
});

function InstructorLayout() {
  return (
    <InternalShell brand="Instructor" subtitle="Teaching Console" nav={INSTRUCTOR_NAV} profileTo="/instructor/profile">
      <Outlet />
    </InternalShell>
  );
}
