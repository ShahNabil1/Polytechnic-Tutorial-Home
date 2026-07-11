import { createFileRoute } from "@tanstack/react-router";
import { AcademicStructureManager } from "@/components/internal/lms/AcademicStructureManager";

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/structure",
)({
  head: () => ({ meta: [{ title: "Academic Structure — LMS" }, { name: "robots", content: "noindex" }] }),
  component: () => <AcademicStructureManager />,
});
