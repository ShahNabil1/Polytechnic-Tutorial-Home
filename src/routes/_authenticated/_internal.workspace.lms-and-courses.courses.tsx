import { createFileRoute } from "@tanstack/react-router";
import { CoursesManager } from "@/components/internal/lms/CoursesManager";

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/courses",
)({
  head: () => ({ meta: [{ title: "Courses — LMS" }, { name: "robots", content: "noindex" }] }),
  component: () => <CoursesManager />,
});
