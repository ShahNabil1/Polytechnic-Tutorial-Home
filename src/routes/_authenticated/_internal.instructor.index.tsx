import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_internal/instructor/")({
  component: InstructorHome,
});

function InstructorHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Instructor Dashboard
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Your teaching tools and course management will appear here.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-slate-500">
          More instructor features are coming soon.
        </p>
      </div>
    </div>
  );
}
