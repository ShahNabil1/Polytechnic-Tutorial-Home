import { createFileRoute } from "@tanstack/react-router";
import { CurriculumBuilder } from "@/components/internal/lms/CurriculumBuilder";

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/curriculum/$subjectSlug",
)({
  head: () => ({ meta: [{ title: "Curriculum — LMS" }, { name: "robots", content: "noindex" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { subjectSlug } = Route.useParams();
  return <CurriculumBuilder subjectSlug={subjectSlug} />;
}
