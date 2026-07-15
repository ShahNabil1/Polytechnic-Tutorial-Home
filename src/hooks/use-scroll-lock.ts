import { useEffect } from "react";

/**
 * Global reference-counted body scroll lock.
 * Any component that mounts a full-screen overlay (modal, drawer, cropper,
 * bulk-send dialog, onboarding gate, etc.) should call `useScrollLock(open)`.
 * The lock stays engaged as long as at least one caller has it enabled, and
 * automatically restores when the last caller unmounts / disables.
 */

let lockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedHtmlOverflow = "";

function engage() {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  const html = document.documentElement;

  // Compensate for scrollbar disappearance so layout doesn't shift.
  const scrollbarWidth = window.innerWidth - html.clientWidth;

  savedBodyOverflow = body.style.overflow;
  savedBodyPaddingRight = body.style.paddingRight;
  savedHtmlOverflow = html.style.overflow;

  if (scrollbarWidth > 0) {
    const current = parseInt(getComputedStyle(body).paddingRight || "0", 10) || 0;
    body.style.paddingRight = `${current + scrollbarWidth}px`;
  }
  body.style.overflow = "hidden";
  html.style.overflow = "hidden";
}

function release() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const body = document.body;
  const html = document.documentElement;
  body.style.overflow = savedBodyOverflow;
  body.style.paddingRight = savedBodyPaddingRight;
  html.style.overflow = savedHtmlOverflow;
}

export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    engage();
    return () => {
      release();
    };
  }, [active]);
}
