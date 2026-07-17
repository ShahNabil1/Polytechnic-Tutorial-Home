// Smooth skeleton shown on first fetch (Redis cache miss). Mirrors the
// profile layout so there's no flash/shift when real data arrives.

type Props = { variant?: "bn" | "en" };

export function ProfileSkeleton({ variant = "bn" }: Props) {
  const titleClass = "h-6 w-56 rounded-md bg-muted/70";
  const subtitleClass = "mt-2 h-4 w-72 rounded-md bg-muted/60";

  return (
    <div className="space-y-6 animate-in fade-in duration-300" aria-busy="true" aria-live="polite">
      <div>
        <div className={titleClass + " shimmer"} />
        <div className={subtitleClass + " shimmer"} />
      </div>

      {/* Avatar + identity card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="size-24 rounded-full bg-muted/70 shimmer" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-48 rounded-md bg-muted/70 shimmer" />
            <div className="h-4 w-64 rounded-md bg-muted/60 shimmer" />
            <div className="h-4 w-40 rounded-md bg-muted/60 shimmer" />
          </div>
        </div>
      </div>

      {/* Form fields card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {Array.from({ length: variant === "bn" ? 6 : 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted/60 shimmer" />
              <div className="h-10 w-full rounded-md bg-muted/50 shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Security card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-muted/70 shimmer" />
        <div className="mt-4 space-y-3">
          <div className="h-12 w-full rounded-md bg-muted/50 shimmer" />
          <div className="h-12 w-full rounded-md bg-muted/50 shimmer" />
        </div>
      </div>

      <span className="sr-only">
        {variant === "bn" ? "প্রোফাইল লোড হচ্ছে…" : "Loading profile…"}
      </span>
    </div>
  );
}
