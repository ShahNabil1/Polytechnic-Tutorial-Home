import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, ShieldOff, ShieldCheck, UserMinus, IdCard } from "lucide-react";
import {
  listInternalUsers,
  findUserByPhoneOrEmail,
  assignInternalRole,
  revokeInternalRole,
  setInternalUserActive,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { toEnglishText } from "@/lib/input-filter";

export function AdminUsersManagerEN({ role }: { role: "employee" | "instructor" }) {
  const list = useServerFn(listInternalUsers);
  const findUser = useServerFn(findUserByPhoneOrEmail);
  const assign = useServerFn(assignInternalRole);
  const revoke = useServerFn(revokeInternalRole);
  const setActive = useServerFn(setInternalUserActive);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<
    Array<{ id: string; full_name: string | null; phone: string | null; email: string | null }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list({ data: undefined as never });
      setRows((data ?? []).filter((r) => r.role === role));
    } catch (e) {
      toast.error("Failed to load: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, [role]);

  async function search() {
    if (query.trim().length < 3) return toast.error("Enter at least 3 characters");
    setSearching(true);
    try {
      const res = await findUser({ data: { query: query.trim() } });
      setCandidates(res);
      if (res.length === 0) toast.info("No users found");
    } catch (e) {
      toast.error("Search failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSearching(false);
    }
  }

  async function assignUser(userId: string) {
    setBusyId(userId);
    try {
      await assign({ data: { user_id: userId, role } });
      toast.success(role === "employee" ? "Added as employee" : "Added as instructor");
      setCandidates([]);
      setQuery("");
      await refresh();
    } catch (e) {
      toast.error("Failed to add: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function revokeUser(userId: string) {
    if (!confirm("Revoke this role?")) return;
    setBusyId(userId);
    try {
      await revoke({ data: { user_id: userId, role } });
      toast.success("Role revoked");
      await refresh();
    } catch (e) {
      toast.error("Revoke failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: AdminUserRow) {
    setBusyId(row.user_id);
    try {
      await setActive({ data: { user_id: row.user_id, is_active: !row.is_active } });
      toast.success(row.is_active ? "Deactivated" : "Activated");
      await refresh();
    } catch (e) {
      toast.error("Update failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  const label = role === "employee" ? "Employee" : "Instructor";
  const labelPlural = role === "employee" ? "Employees" : "Instructors";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {labelPlural}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Assign, revoke and manage {labelPlural.toLowerCase()} access.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <UserPlus className="size-4 text-indigo-600" /> Add a new {label}
        </h2>
        <p className="mb-3 text-xs font-medium text-slate-500">
          The user must have signed up already. Search by phone or email and add them.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(toEnglishText(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Phone (880...) or email"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Search
          </button>
        </div>
        {candidates.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {c.full_name || "(no name)"}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {c.phone || c.email || c.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => assignUser(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {busyId === c.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-base font-bold tracking-tight">
          All {labelPlural} <span className="text-slate-400">({rows.length})</span>
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
            No {labelPlural.toLowerCase()} yet
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {rows.map((r) => (
              <li
                key={r.user_id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {(r.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {r.full_name || "(no name)"}
                      </span>
                      {r.display_id && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          <IdCard className="size-3" /> #{r.display_id}
                        </span>
                      )}
                      {!r.is_active && (
                        <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          Inactive
                        </span>
                      )}
                      {r.mfa_enrolled && (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          2FA
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {r.phone || r.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    disabled={busyId === r.user_id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                  >
                    {r.is_active ? (
                      <ShieldOff className="size-3.5" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeUser(r.user_id)}
                    disabled={busyId === r.user_id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    <UserMinus className="size-3.5" /> Revoke Role
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
