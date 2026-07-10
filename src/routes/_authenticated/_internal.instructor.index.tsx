import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_internal/instructor/")({
  component: InstructorHome,
});

function InstructorHome() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      ইন্সট্রাক্টর ড্যাশবোর্ডের ফিচার পরবর্তী স্টেপে যোগ হবে।
    </div>
  );
}
