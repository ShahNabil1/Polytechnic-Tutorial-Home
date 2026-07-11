import { createFileRoute } from "@tanstack/react-router";
import { SubjectsManager } from "@/components/internal/lms/SubjectsManager";

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/subjects",
)({
  head: () => ({ meta: [{ title: "Subjects — LMS" }, { name: "robots", content: "noindex" }] }),
  component: () => <SubjectsManager />,
});
