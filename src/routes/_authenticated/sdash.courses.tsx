import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sdash/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">আমার কোর্স</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          আপনার এনরোল করা কোর্স ও লেসন প্রগ্রেস।
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">
          <BookOpen className="size-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">এখনো কোনো কোর্সে এনরোল হননি</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          কোর্স ক্যাটালগ থেকে পছন্দের কোর্স বাছাই করে এনরোল করুন।
        </p>
        <Link
          to="/"
          hash="courses"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
        >
          কোর্স দেখুন
        </Link>
      </div>
    </div>
  );
}
