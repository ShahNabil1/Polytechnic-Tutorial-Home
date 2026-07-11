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
import { confirm as confirmDialog } from "@/components/ui/confirm-dialog";

export function AdminUsersManager({ role }: { role: "employee" | "instructor" }) {
  const list = useServerFn(listInternalUsers);
  const findUser = useServerFn(findUserByPhoneOrEmail);
  const assign = useServerFn(assignInternalRole);
  const revoke = useServerFn(revokeInternalRole);
  const setActive = useServerFn(setInternalUserActive);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ id: string; full_name: string | null; phone: string | null; email: string | null }>>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list({ data: undefined as never });
      setRows((data ?? []).filter((r) => r.role === role));
    } catch (e) {
      toast.error("লোড ব্যর্থ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, [role]);

  async function search() {
    if (query.trim().length < 3) return toast.error("কমপক্ষে ৩ অক্ষর দিন");
    setSearching(true);
    try {
      const res = await findUser({ data: { query: query.trim() } });
      setCandidates(res);
      if (res.length === 0) toast.info("কোনো ইউজার পাওয়া যায়নি");
    } catch (e) {
      toast.error("সার্চ ব্যর্থ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSearching(false);
    }
  }

  async function assignUser(userId: string) {
    setBusyId(userId);
    try {
      await assign({ data: { user_id: userId, role } });
      toast.success(role === "employee" ? "এমপ্লয়ি হিসেবে যোগ করা হয়েছে" : "ইন্সট্রাক্টর হিসেবে যোগ করা হয়েছে");
      setCandidates([]);
      setQuery("");
      await refresh();
    } catch (e) {
      toast.error("যোগ করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function revokeUser(userId: string) {
    if (!(await confirmDialog({ variant: "danger", description: "এই রোল বাতিল করবেন?" }))) return;
    setBusyId(userId);
    try {
      await revoke({ data: { user_id: userId, role } });
      toast.success("রোল বাতিল হয়েছে");
      await refresh();
    } catch (e) {
      toast.error("বাতিল ব্যর্থ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(row: AdminUserRow) {
    setBusyId(row.user_id);
    try {
      await setActive({ data: { user_id: row.user_id, is_active: !row.is_active } });
      toast.success(row.is_active ? "ডিএকটিভেট হয়েছে" : "একটিভেট হয়েছে");
      await refresh();
    } catch (e) {
      toast.error("আপডেট ব্যর্থ: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  const label = role === "employee" ? "এমপ্লয়ি" : "ইন্সট্রাক্টর";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <UserPlus className="size-4 text-brand" /> নতুন {label} যোগ করুন
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          ইউজার আগে সাইন আপ করা থাকতে হবে। তার ফোন বা ইমেইল দিয়ে খুঁজে যোগ করুন।
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(toEnglishText(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="ফোন (880...) বা ইমেইল"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={search}
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            খুঁজুন
          </button>
        </div>
        {candidates.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.full_name || "(নামহীন)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone || c.email || c.id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => assignUser(c.id)}
                  disabled={busyId === c.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  যোগ করুন
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">সব {label} ({rows.length})</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            এখনো কেউ নেই
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => (
              <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {(r.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.full_name || "(নামহীন)"}</span>
                      {r.display_id && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          <IdCard className="size-3" /> #{r.display_id}
                        </span>
                      )}
                      {!r.is_active && (
                        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          ইনঅ্যাক্টিভ
                        </span>
                      )}
                      {r.mfa_enrolled && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          2FA
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.phone || r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    disabled={busyId === r.user_id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-60"
                  >
                    {r.is_active ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                    {r.is_active ? "ডিএকটিভেট" : "একটিভেট"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeUser(r.user_id)}
                    disabled={busyId === r.user_id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
                  >
                    <UserMinus className="size-3.5" /> রোল বাতিল
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
