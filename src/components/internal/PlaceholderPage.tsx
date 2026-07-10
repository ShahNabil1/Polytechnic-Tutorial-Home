import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

type Props = {
  section: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PlaceholderPage({ section, title, description, icon: Icon }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          {section}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm font-medium text-slate-500">{description}</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-xl shadow-indigo-500/30">
            <Icon className="size-8 text-white" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-slate-900">
            {title} module is coming soon
          </h2>
          <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
            We're wiring up this section. The interface and workflows will land here shortly.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
            <Sparkles className="size-3.5" />
            In development
          </div>
        </div>
      </div>
    </div>
  );
}
