import { createFileRoute } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/_internal/workspace/")({
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { info } = useRole();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Manage your workspace, team and access controls from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Your Role
          </p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 capitalize">
            {info?.primaryRole?.replace("_", " ")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Permissions
          </p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
            {info?.permissions?.length ?? 0}
          </p>
        </div>
      </div>

      {info?.permissions && info.permissions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-900">Granted permissions</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {info.permissions.map((p) => (
              <li
                key={p}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
