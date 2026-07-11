import { useCallback, useEffect, useState } from "react";
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone, Tablet, LogOut, Shield, Pencil, Check, X, ShieldOff, MapPin, Globe } from "lucide-react";
import { ensureReauth } from "@/lib/reauth";
import { toEnglishText } from "@/lib/input-filter";
import { SESSION_LABEL_MAX, validateSessionLabel } from "@/lib/session-label";
import {
  listTrackedSessions,
  registerTrackedSession,
  renameTrackedSession,
  revokeOtherTrackedSessions,
  revokeTrackedSession,
  type TrackedSession,
} from "@/lib/session-api";

type Session = TrackedSession;

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86400)} দিন আগে`;
}

function locationText(s: Session): string {
  const parts = [s.city, s.region, s.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "অজানা লোকেশন";
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === "mobile") return <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  if (type === "tablet") return <Tablet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
  return <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}

export function SessionsCard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const otherCount = sessions.filter((s) => !s.is_current).length;

  const refresh = useCallback(async () => {
    try {
      await registerTrackedSession();
      const rows = await listTrackedSessions();
      setSessions(rows);
      setLoadError(null);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "Active sessions লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  async function handleRevoke(id: string) {
    if (!(await confirmDialog({ variant: "danger", description: "এই সেশন থেকে সাইন আউট করবেন?" }))) return;
    setRevoking(id);
    try {
      await revokeTrackedSession(id);
      toast.success("সেশন রিভোক হয়েছে");
      await refresh();
    } catch (e) {
      toast.error("রিভোক করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeOthers() {
    if (otherCount === 0) return;
    if (!(await confirmDialog({ variant: "danger", description: `অন্য ${otherCount} টা ডিভাইস থেকে সাইন আউট করবেন?` }))) return;
    if (!(await ensureReauth())) return;
    setRevokingOthers(true);
    try {
      const r = await revokeOtherTrackedSessions();
      toast.success(`${r.revoked} টি সেশন সাইন আউট করা হয়েছে`);
      await refresh();
    } catch (e) {
      toast.error("রিভোক করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRevokingOthers(false);
    }
  }

  function startEdit(s: Session) {
    setEditingId(s.id);
    setDraft(s.device_label ?? "");
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }
  const draftError = editingId ? validateSessionLabel(draft) : null;

  async function saveEdit(id: string) {
    const label = draft.trim();
    const err = validateSessionLabel(label);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      await renameTrackedSession(id, label);
      toast.success("নাম আপডেট হয়েছে");
      setEditingId(null);
      setDraft("");
      await refresh();
    } catch (e) {
      toast.error("রিনেম করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Shield className="size-4 text-brand" />
            Active sessions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            একসাথে সর্বোচ্চ ২ ডিভাইসে সাইন-ইন থাকতে পারবেন। ৩য় ডিভাইসে লগইন করলে
            একটা পুরানো সেশন কেটে দিতে হবে।
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {sessions.length}/2
        </span>
      </div>

      {!loading && otherCount > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            এই ডিভাইস রেখে বাকি {otherCount} টি সেশন থেকে সাইন আউট করুন।
          </span>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokingOthers}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          >
            {revokingOthers ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
            অন্য সব ডিভাইস থেকে সাইন আউট
          </button>
        </div>
      )}

      {!loading && loadError && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Active sessions লোড করা যায়নি। আবার সাইন ইন করে চেষ্টা করুন।
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {sessions.map((s) => {
            const isEditing = editingId === s.id;
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <DeviceIcon type={s.device_type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(toEnglishText(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !draftError) saveEdit(s.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            maxLength={SESSION_LABEL_MAX}
                            placeholder="যেমন: My Laptop"
                            aria-invalid={!!draftError}
                            className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none ${
                              draftError ? "border-destructive focus:border-destructive" : "border-border focus:border-brand"
                            }`}
                          />
                          {draftError ? (
                            <span className="text-[11px] text-destructive">{draftError}</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {draft.trim().length}/{SESSION_LABEL_MAX}
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="truncate text-sm font-medium">{s.device_label || "Unknown"}</span>
                          {s.is_current && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              এই ডিভাইস
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label="Rename"
                            title="Rename"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {(s.browser || s.os) && (
                          <span>{[s.browser, s.os].filter(Boolean).join(" · ")}</span>
                        )}
                        {s.device_type && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            {s.device_type}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="size-3" /> IP {s.ip || "unknown"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {locationText(s)}
                        </span>
                        {s.timezone && <span>· {s.timezone}</span>}
                      </div>
                      <div>সর্বশেষ {relTime(s.last_seen_at)}</div>
                    </div>
                  </div>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => saveEdit(s.id)}
                      disabled={saving || !!draftError}
                      className="inline-flex items-center gap-1 rounded-md border border-brand/40 px-2 py-1 text-xs text-brand hover:bg-brand/10 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  !s.is_current && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.id)}
                      disabled={revoking === s.id}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-60"
                    >
                      {revoking === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                      সাইন আউট
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
