import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_internal/workspace/lms-and-courses")({
  head: () => ({
    meta: [
      { title: "LMS & Courses — Workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
