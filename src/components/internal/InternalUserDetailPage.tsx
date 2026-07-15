import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowLeft,
  ScrollText,
  Loader2,
  UserIcon,
  IdCard,
  FileDown,
  ShieldOff,
  ShieldCheck,
  UserMinus,
  Trash2,
  KeyRound,
  LogOut,
  UserCog,
  RefreshCw,
} from "lucide-react";
import {
  getInternalUserDetail,
  getUserCvSignedUrl,
  listUserSessionsAsAdmin,
  revokeUserSessionAsAdmin,
  revokeAllUserSessionsAsAdmin,
  resetUserMfa,
  deleteInternalUser,
  setInternalUserActive,
  revokeInternalRole,
  type InternalUserDetail,
} from "@/lib/admin-users.functions";
import { InternalEmailLogsDialog } from "@/components/internal/InternalEmailLogsDialog";
import { beginImpersonation } from "@/lib/impersonation";

type Props = { userId: string; role: "employee" | "instructor" };

export function InternalUserDetailPage({ userId, role }: Props) {
  const router = useRouter();
  const getDetail = useServerFn(getInternalUserDetail);
  const getCv = useServerFn(getUserCvSignedUrl);
  const listSessions = useServerFn(listUserSessionsAsAdmin);
  const revokeSession = useServerFn(revokeUserSessionAsAdmin);
  const revokeAllSessions = useServerFn(revokeAllUserSessionsAsAdmin);
  const resetMfa = useServerFn(resetUserMfa);
  const deleteUser = useServerFn(deleteInternalUser);
  const toggleActive = useServerFn(setInternalUserActive);
  const revokeRole = useServerFn(revokeInternalRole);

  const [detail, setDetail] = useState<InternalUserDetail | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        getDetail({ data: { user_id: userId } }),
        listSessions({ data: { user_id: userId } }),
      ]);
      setDetail(d);
      setSessions(s ?? []);
    } catch (e) {
      toast.error("Load failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [userId, getDetail, listSessions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDownloadCv() {
    setBusy("cv");
    try {
      const res = await getCv({ data: { user_id: userId } });
      window.open((res as { url: string }).url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("CV download failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleImpersonate() {
    if (
      !(await confirmDialog({
        title: "Enter this user's dashboard?",
        description:
          "You'll be signed in as this user in this tab. A banner will let you return to your admin account.",
      }))
    )
      return;
    setBusy("impersonate");
    try {
      const { redirectTo } = await beginImpersonation({
        user_id: userId,
        targetLabel: detail?.full_name || detail?.email || "user",
      });
      toast.success("Signed in as user");
      router.navigate({ to: redirectTo });
    } catch (e) {
      toast.error("Impersonation failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeSession(id: string) {
    if (!(await confirmDialog({ variant: "danger", description: "Sign this device out?" }))) return;
    setBusy("sess-" + id);
    try {
      await revokeSession({ data: { user_id: userId, session_id: id } });
      toast.success("Session revoked");
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error("Revoke failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeAllSessions() {
    if (
      !(await confirmDialog({
        variant: "danger",
        title: "Sign out everywhere?",
        description: "All devices will be signed out immediately.",
      }))
    )
      return;
    setBusy("sess-all");
    try {
      await revokeAllSessions({ data: { user_id: userId } });
      toast.success("All sessions signed out");
      setSessions([]);
    } catch (e) {
      toast.error("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleResetMfa() {
    if (
      !(await confirmDialog({
        variant: "danger",
        title: "Reset 2FA?",
        description:
          "All authenticator factors will be removed. The user can then set up 2FA again from their profile.",
      }))
    )
      return;
    setBusy("mfa");
    try {
      const r = await resetMfa({ data: { user_id: userId } });
      toast.success(`2FA reset (${(r as any).cleared ?? 0} factor(s) removed)`);
      await refresh();
    } catch (e) {
      toast.error("Reset failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleActive() {
    if (!detail) return;
    setBusy("active");
    try {
      await toggleActive({ data: { user_id: userId, is_active: !detail.is_active } });
      toast.success(detail.is_active ? "Deactivated" : "Activated");
      await refresh();
    } catch (e) {
      toast.error("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeRole() {
    if (
      !(await confirmDialog({
        variant: "danger",
        title: `Revoke ${role} role?`,
        description: "This removes the role but keeps the auth account.",
      }))
    )
      return;
    setBusy("revoke");
    try {
      await revokeRole({ data: { user_id: userId, role } });
      toast.success("Role revoked");
      router.navigate({ to: role === "employee" ? "/workspace/employees" : "/workspace/instructors" });
    } catch (e) {
      toast.error("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!detail?.email) {
      toast.error("Target has no email on file — cannot confirm delete");
      return;
    }
    const typed = window.prompt(
      `PERMANENT DELETE. Type the user's email to confirm:\n${detail.email}`,
      "",
    );
    if (!typed) return;
    if (typed.trim().toLowerCase() !== detail.email.toLowerCase()) {
      toast.error("Email did not match");
      return;
    }
    setBusy("delete");
    try {
      await deleteUser({ data: { user_id: userId, confirm_email: detail.email } });
      toast.success("Account permanently deleted");
      router.navigate({ to: role === "employee" ? "/workspace/employees" : "/workspace/instructors" });
    } catch (e) {
      toast.error("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !detail) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const backTo = role === "employee" ? "/workspace/employees" : "/workspace/instructors";
  const label = role === "employee" ? "Employee" : "Instructor";

  return (
    <div className="space-y-6">
      {/* Top bar: back + Logs + View (view is current page; keep only Logs action per user request) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" /> Back to {label.toLowerCase()}s
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ScrollText className="size-3.5" /> Email Logs
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Header card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="group relative">
            {detail.avatar_url ? (
              <img
                src={detail.avatar_url}
                alt=""
                className="size-24 rounded-full object-cover ring-2 ring-indigo-500/30"
              />
            ) : (
              <div className="grid size-24 place-items-center rounded-full bg-slate-100">
                <UserIcon className="size-9 text-slate-400" />
              </div>
            )}
            {detail.avatar_url && (
              <a
                href={detail.avatar_url}
                download={`${(detail.full_name || "avatar").replace(/[^a-z0-9-_]+/gi, "_")}.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                title="Download profile picture"
                className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FileDown className="size-3.5" />
              </a>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                {detail.full_name || "(no name)"}
              </h1>
              {detail.display_id && (
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                  <IdCard className="size-3" /> #{detail.display_id}
                </span>
              )}
              {!detail.is_active && (
                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                  Inactive
                </span>
              )}
              {detail.mfa_enrolled && (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  2FA · {detail.mfa_factor_count}
                </span>
              )}
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {label}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-slate-600">
              {detail.email || "(no email)"}
              {detail.phone && <span className="mx-2 text-slate-300">·</span>}
              {detail.phone}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleImpersonate}
                disabled={busy === "impersonate"}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {busy === "impersonate" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserCog className="size-3.5" />
                )}
                Enter dashboard as user
              </button>
              <button
                type="button"
                onClick={handleDownloadCv}
                disabled={busy === "cv" || !detail.cv_r2_key}
                title={detail.cv_r2_key ? "Download CV" : "No CV on file"}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {busy === "cv" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileDown className="size-3.5" />
                )}
                Download CV
              </button>
              <button
                type="button"
                onClick={handleResetMfa}
                disabled={busy === "mfa"}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {busy === "mfa" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                Reset 2FA
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Info grid */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-base font-bold tracking-tight">Account information</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label="Full name" value={detail.full_name} />
          <Info label="Email (primary ID)" value={detail.email} />
          <Info label="Phone" value={detail.phone} />
          <Info label="Display ID" value={detail.display_id} />
          <Info label="Roles" value={detail.roles.join(", ") || "(none)"} />
          <Info label="Providers" value={detail.auth.providers.join(", ") || "email"} />
          <Info
            label="Account created"
            value={detail.auth.created_at ? new Date(detail.auth.created_at).toLocaleString() : "—"}
          />
          <Info
            label="Last sign-in"
            value={detail.auth.last_sign_in_at ? new Date(detail.auth.last_sign_in_at).toLocaleString() : "—"}
          />
          <Info label="Workplace" value={detail.workplace} />
          <Info label="Job role" value={detail.job_role} />
          <Info label="Address" value={detail.address} />
          <Info label="NID" value={detail.nid_number} />
          {detail.subjects.length > 0 && (
            <Info label="Subjects" value={detail.subjects.join(", ")} />
          )}
          {detail.departments.length > 0 && (
            <Info label="Departments" value={detail.departments.join(", ")} />
          )}
        </dl>
        {detail.bank_details && (
          <div className="mt-6">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Payment details
            </div>
            <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(detail.bank_details, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold tracking-tight">
            Active sessions <span className="text-slate-400">({sessions.length})</span>
          </h2>
          <button
            type="button"
            onClick={handleRevokeAllSessions}
            disabled={busy === "sess-all" || sessions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40"
          >
            {busy === "sess-all" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <LogOut className="size-3.5" />
            )}
            Sign out everywhere
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm font-medium text-slate-500">
            No active sessions
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">
                    {s.device_label || `${s.browser ?? "Browser"} · ${s.os ?? ""}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[s.city, s.region, s.country].filter(Boolean).join(", ") || s.ip || "unknown location"}
                    {s.last_seen_at && (
                      <> · last seen {new Date(s.last_seen_at).toLocaleString()}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeSession(s.id)}
                  disabled={busy === "sess-" + s.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {busy === "sess-" + s.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <LogOut className="size-3.5" />
                  )}
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
        <h2 className="mb-1 font-display text-base font-bold tracking-tight text-red-900">Danger zone</h2>
        <p className="mb-4 text-xs font-medium text-red-800/80">
          These actions affect the user immediately.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={busy === "active"}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {detail.is_active ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            {detail.is_active ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            onClick={handleRevokeRole}
            disabled={busy === "revoke"}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <UserMinus className="size-3.5" /> Revoke {label} role
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy === "delete"}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy === "delete" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Permanently delete account
          </button>
        </div>
      </section>

      {showLogs && (
        <InternalEmailLogsDialog
          userId={userId}
          userLabel={`${detail.full_name || "(no name)"} · ${detail.email || detail.phone || ""}`}
          onClose={() => setShowLogs(false)}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
