import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  UserPlus,
  IdCard,
  Eye,
  EyeOff,
  RefreshCw,
  ScrollText,
  ExternalLink,
} from "lucide-react";
import {
  listInternalUsers,
  createInternalUser,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { InternalEmailLogsDialog } from "@/components/internal/InternalEmailLogsDialog";

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
};

const EMPTY_FORM: FormState = { full_name: "", email: "", phone: "", password: "" };

function generatePassword(len = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function AdminUsersManagerEN({ role }: { role: "employee" | "instructor" }) {
  const list = useServerFn(listInternalUsers);
  const createUser = useServerFn(createInternalUser);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logsFor, setLogsFor] = useState<AdminUserRow | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || form.password.length < 8) {
      toast.error("Fill all fields. Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await createUser({
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          role,
        },
      });
      toast.success(role === "employee" ? "Employee created" : "Instructor created");
      setForm(EMPTY_FORM);
      setShowPw(false);
      await refresh();
    } catch (err) {
      toast.error("Create failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
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
          Create, revoke and manage {labelPlural.toLowerCase()} accounts. Public sign-up is disabled for this role.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <UserPlus className="size-4 text-indigo-600" /> Create a new {label}
        </h2>
        <p className="mb-4 text-xs font-medium text-slate-500">
          The email you set becomes the primary account ID (used for Google sign-in and 2FA recovery). The user will be asked to change the password and complete their profile on first login.
        </p>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Full name
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Doe"
              autoComplete="off"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Email (primary ID)
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
              autoComplete="off"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^\d+]/g, "") }))}
              placeholder="8801XXXXXXXXX"
              autoComplete="off"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
            Initial password
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-9 text-sm font-normal text-slate-900 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-2 grid place-items-center text-slate-500 hover:text-slate-800"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, password: generatePassword() }));
                  setShowPw(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="size-3.5" /> Generate
              </button>
            </div>
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Create {label}
            </button>
          </div>
        </form>
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
                      {r.email || r.phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLogsFor(r)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    title="View welcome-email delivery logs"
                  >
                    <ScrollText className="size-3.5" /> Logs
                  </button>
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

      {logsFor && (
        <InternalEmailLogsDialog
          userId={logsFor.user_id}
          userLabel={`${logsFor.full_name || "(no name)"} · ${logsFor.email || logsFor.phone || ""}`}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
}
