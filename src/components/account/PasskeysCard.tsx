import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { listMyPasskeys, deleteMyPasskey } from "@/lib/passkey.functions";
import { ensureReauth } from "@/lib/reauth";

const MAX_PASSKEYS = 3;

type Passkey = Awaited<ReturnType<typeof listMyPasskeys>>[number];

export function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);

  async function refresh() {
    try {
      const list = await listMyPasskeys();
      setPasskeys(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd() {
    if (passkeys.length >= MAX_PASSKEYS) {
      toast.error(`সর্বোচ্চ ${MAX_PASSKEYS} টা Passkey রাখা যাবে`);
      return;
    }
    setAdding(true);
    try {
      const { registerPasskey } = await import("@/lib/passkey-client");
      await registerPasskey(deviceName.trim() || undefined);
      toast.success("Passkey সেভ হয়েছে");
      setDeviceName("");
      setShowNameInput(false);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/NotAllowed|cancel|abort/i.test(msg)) {
        toast.error("Passkey প্রম্পট বাতিল হয়েছে");
      } else {
        toast.error("Passkey সেভ করা যায়নি: " + msg);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string, name: string | null) {
    if (!confirm(`"${name || "এই Passkey"}" রিমুভ করবেন?`)) return;
    if (!(await ensureReauth())) return;
    try {
      await deleteMyPasskey({ data: { id } });
      toast.success("Passkey রিমুভ হয়েছে");
      await refresh();
    } catch (e) {
      toast.error("রিমুভ করা যায়নি: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="size-4 text-brand" />
            Passkeys
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            সর্বোচ্চ {MAX_PASSKEYS} টা ডিভাইসে Passkey রাখতে পারবেন। Apple Passwords / Google
            Passwords এর মত পাসওয়ার্ড ছাড়া লগইন হবে।
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {passkeys.length}/{MAX_PASSKEYS}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : passkeys.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
          কোনো Passkey সেভ করা নেই। নিচের বাটন থেকে যোগ করুন।
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{pk.device_name || "নামহীন ডিভাইস"}</div>
                <div className="text-[11px] text-muted-foreground">
                  যোগ করেছেন {new Date(pk.created_at).toLocaleDateString("bn-BD")}
                  {pk.last_used_at && ` · সর্বশেষ ${new Date(pk.last_used_at).toLocaleDateString("bn-BD")}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(pk.id, pk.device_name)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                রিমুভ
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {showNameInput ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="ডিভাইসের নাম (যেমন: আমার iPhone)"
              maxLength={100}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || passkeys.length >= MAX_PASSKEYS}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-60"
              >
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNameInput(false);
                  setDeviceName("");
                }}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
              >
                বাতিল
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNameInput(true)}
            disabled={passkeys.length >= MAX_PASSKEYS}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
          >
            <Plus className="size-4" />
            নতুন Passkey যোগ করুন
          </button>
        )}
      </div>
    </section>
  );
}
