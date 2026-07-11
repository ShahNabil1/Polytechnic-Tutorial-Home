import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SubjectsManager } from "@/components/internal/lms/SubjectsManager";

const searchSchema = z.object({
  dept: fallback(z.string(), "").default(""),
  sem: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute(
  "/_authenticated/_internal/workspace/lms-and-courses/subjects",
)({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Subjects — LMS" }, { name: "robots", content: "noindex" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { dept, sem } = Route.useSearch();
  return <SubjectsManager deptFilter={dept} semFilter={sem} />;
}
