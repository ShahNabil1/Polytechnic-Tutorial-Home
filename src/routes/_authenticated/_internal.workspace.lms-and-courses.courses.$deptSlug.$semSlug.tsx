import { createFileRoute } from "@tanstack/react-router";
import { CourseDetail } from "@/components/internal/lms/CourseDetail";

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/courses/$deptSlug/$semSlug",
)({
  head: () => ({ meta: [{ title: "Course — LMS" }, { name: "robots", content: "noindex" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { deptSlug, semSlug } = Route.useParams();
  return <CourseDetail deptSlug={deptSlug} semSlug={semSlug} />;
}
