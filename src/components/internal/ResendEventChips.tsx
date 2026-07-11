import { cn } from "@/lib/utils";

// Resend brand mark — simplified "R" glyph in a rounded square.
// Used as a tiny identifier so admins recognize these chips come from the
// Resend webhook (auto-updated in realtime).
export function ResendLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Resend"
    >
      <rect width="24" height="24" rx="5" fill="currentColor" />
      <path
        d="M8 6.5h5.2c2.35 0 3.9 1.4 3.9 3.55 0 1.6-.9 2.75-2.35 3.25L17.6 17.5h-2.9l-2.5-3.85H10.6V17.5H8V6.5Zm2.6 2.2v2.9h2.5c1.05 0 1.7-.55 1.7-1.45 0-.9-.65-1.45-1.7-1.45h-2.5Z"
        fill="#fff"
      />
    </svg>
  );
}

export type EmailEvents = {
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  error_reason: string | null;
  updated_at?: string | null;
};

type ChipDef = {
  key: string;
  label: string;
  cls: string; // color classes
  active: boolean;
  title: string;
};

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function ResendEventChips({ events }: { events: EmailEvents | null }) {
  if (!events) return null;

  const chips: ChipDef[] = [
    {
      key: "scheduled",
      label: "Scheduled",
      cls: "bg-slate-50 text-slate-700 ring-slate-200",
      active: events.status === "scheduled",
      title: `Scheduled${events.updated_at ? ` · ${fmt(events.updated_at)}` : ""}`,
    },
    {
      key: "sent",
      label: "Sent",
      cls: "bg-sky-50 text-sky-700 ring-sky-200",
      active: !!events.sent_at,
      title: `Sent · ${fmt(events.sent_at)}`,
    },
    {
      key: "delayed",
      label: "Delayed",
      cls: "bg-amber-50 text-amber-800 ring-amber-200",
      active: events.status === "delayed",
      title: `Delayed${events.error_reason ? ` · ${events.error_reason}` : ""}`,
    },
    {
      key: "delivered",
      label: "Delivered",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      active: !!events.delivered_at,
      title: `Delivered · ${fmt(events.delivered_at)}`,
    },
    {
      key: "opened",
      label: "Opened",
      cls: "bg-violet-50 text-violet-700 ring-violet-200",
      active: !!events.opened_at,
      title: `Opened · ${fmt(events.opened_at)}`,
    },
    {
      key: "clicked",
      label: "Clicked",
      cls: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
      active: !!events.clicked_at,
      title: `Clicked · ${fmt(events.clicked_at)}`,
    },
    {
      key: "bounced",
      label: "Bounced",
      cls: "bg-rose-50 text-rose-700 ring-rose-200",
      active: !!events.bounced_at || events.status === "bounced",
      title: `Bounced${events.error_reason ? ` · ${events.error_reason}` : ""}`,
    },
    {
      key: "failed",
      label: "Failed",
      cls: "bg-red-50 text-red-700 ring-red-200",
      active: events.status === "failed",
      title: `Failed${events.error_reason ? ` · ${events.error_reason}` : ""}`,
    },
  ];

  const visible = chips.filter((c) => c.active);
  if (visible.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {visible.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
            c.cls,
          )}
        >
          <ResendLogo className="size-3 text-slate-900/80" />
          {c.label}
        </span>
      ))}
    </div>
  );
}
