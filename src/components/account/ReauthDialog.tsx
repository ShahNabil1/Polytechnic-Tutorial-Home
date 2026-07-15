import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, X, KeyRound, Lock } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";
import { verifyPasswordReauth } from "@/lib/reauth.functions";
import { getPasskeyAuthOptions, verifyPasskeyAuthentication, listMyPasskeys } from "@/lib/passkey.functions";
import { markReauthed, registerReauthDialog, setReauthMethodsAvailable } from "@/lib/reauth";
import { toEnglishPassword } from "@/lib/input-filter";
import { retrySupabaseAuth } from "@/lib/auth-reliability";

/**
 * Modal host for step-up reauth. Mount once inside the profile page.
 * Any code calling ensureReauth() gets a Promise<boolean>.
 */
export function ReauthDialogHost() {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const [hasPassword, setHasPassword] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [ready, setReady] = useState(false);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await retrySupabaseAuth(() => supabase.auth.getUser());
        const providers = (data.user?.app_metadata?.providers as string[] | undefined) ?? [];
        const pw = providers.includes("email") || providers.includes("phone");
        setHasPassword(pw);
        setPhone(data.user?.phone ?? null);
        let pk = false;
        try {
          const list = await listMyPasskeys();
          pk = (list?.length ?? 0) > 0;
        } catch {
          pk = false;
        }
        setHasPasskey(pk);
        setReauthMethodsAvailable(pw || (!!data.user?.phone && pk));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    registerReauthDialog(
      () =>
        new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
          setOpen(true);
        }),
    );
  }, []);

  function finish(success: boolean) {
    if (success) markReauthed();
    setPassword("");
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    r?.(success);
  }

  async function tryPassword() {
    if (!password) return;
    setBusy(true);
    try {
      const r = await verifyPasswordReauth({ data: { password } });
      if (r.ok) {
        toast.success("যাচাই সম্পন্ন");
        finish(true);
      } else {
        toast.error("বর্তমান পাসওয়ার্ড ভুল");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function tryPasskey() {
    if (!phone) return;
    setBusy(true);
    try {
      const options = await getPasskeyAuthOptions({ data: { phone } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asseResp = await startAuthentication({ optionsJSON: options as any });
      // Verify only — don't call setSession so the current session/tokens
      // and the SessionEnforcer row remain untouched.
      await verifyPasskeyAuthentication({ data: { phone, response: asseResp } });
      toast.success("Passkey যাচাই সম্পন্ন");
      finish(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/NotAllowed|cancel|abort/i.test(msg)) toast.error("Passkey বাতিল হয়েছে");
      else toast.error("যাচাই ব্যর্থ: " + msg);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const canPassword = ready && hasPassword;
  const canPasskey = ready && !!phone && hasPasskey;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !busy && finish(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-4 text-brand" />
              পরিচয় নিশ্চিত করুন
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              সংবেদনশীল একাউন্ট পরিবর্তনের আগে আপনাকে আবার যাচাই করতে হবে।
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && finish(false)}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !canPassword && !canPasskey ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            যাচাইয়ের কোনো পদ্ধতি সেট নেই। প্রথমে পাসওয়ার্ড অথবা Passkey যোগ করুন।
          </p>
        ) : (
          <div className="space-y-4">
            {canPassword && (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Lock className="size-3.5" />
                    বর্তমান পাসওয়ার্ড
                  </span>
                  <input
                    autoFocus
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(toEnglishPassword(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") tryPassword();
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="••••••••"
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  onClick={tryPassword}
                  disabled={busy || !password}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  পাসওয়ার্ড দিয়ে যাচাই
                </button>
              </div>
            )}

            {canPassword && canPasskey && (
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                অথবা
                <span className="h-px flex-1 bg-border" />
              </div>
            )}

            {canPasskey && (
              <button
                type="button"
                onClick={tryPasskey}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Passkey দিয়ে যাচাই
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
