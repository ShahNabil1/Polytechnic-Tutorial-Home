/**
 * 30-minute inactivity auto-logout.
 * Rule: only counts when the tab is visible; if the tab is hidden for
 * 30 minutes continuously, signs out too.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { signOutSafely } from "@/lib/auth-reliability";

const IDLE_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"];

export function InactivityLogout() {
  useEffect(() => {
    let lastActive = Date.now();
    let hiddenAt: number | null = null;
    let signedOut = false;

    async function doSignOut(reason: string) {
      if (signedOut) return;
      signedOut = true;
      toast.error(reason);
      try {
        await signOutSafely();
      } catch {
        /* ignore */
      }
    }

    function bump() {
      if (document.visibilityState !== "visible") return;
      lastActive = Date.now();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null && Date.now() - hiddenAt >= IDLE_MS) {
          void doSignOut("৩০ মিনিট ইনঅ্যাক্টিভ ছিলেন, সাইন আউট করা হয়েছে");
          return;
        }
        hiddenAt = null;
        lastActive = Date.now();
      }
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    const iv = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        if (now - lastActive >= IDLE_MS) {
          void doSignOut("৩০ মিনিট ইনঅ্যাক্টিভ ছিলেন, সাইন আউট করা হয়েছে");
        }
      } else if (hiddenAt !== null && now - hiddenAt >= IDLE_MS) {
        void doSignOut("৩০ মিনিট ইনঅ্যাক্টিভ ছিলেন, সাইন আউট করা হয়েছে");
      }
    }, 30_000);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(iv);
    };
  }, []);

  return null;
}
