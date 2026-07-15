import { useEffect } from "react";

/**
 * Global reference-counted body scroll lock that also preserves the exact
 * scroll position across open/close cycles (including iOS Safari, where a
 * plain `overflow: hidden` on body can jump the page to the top).
 *
 * Any component that mounts a full-screen overlay (modal, drawer, cropper,
 * bulk-send dialog, onboarding gate, etc.) should call `useScrollLock(open)`.
 * The lock stays engaged as long as at least one caller has it enabled and
 * automatically restores original styles + scroll position when the last
 * caller unmounts / disables it.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedScrollX = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyLeft = "";
let savedBodyRight = "";
let savedBodyWidth = "";
let savedHtmlOverflow = "";
let savedHtmlScrollBehavior = "";

function engage() {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  const html = document.documentElement;

  // Capture the current scroll position so we can restore it on release.
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  savedScrollX = window.scrollX || window.pageXOffset || 0;

  // Compensate for scrollbar disappearance so layout doesn't shift.
  const scrollbarWidth = window.innerWidth - html.clientWidth;

  // Save every style property we're about to mutate.
  savedBodyOverflow = body.style.overflow;
  savedBodyPaddingRight = body.style.paddingRight;
  savedBodyPosition = body.style.position;
  savedBodyTop = body.style.top;
  savedBodyLeft = body.style.left;
  savedBodyRight = body.style.right;
  savedBodyWidth = body.style.width;
  savedHtmlOverflow = html.style.overflow;
  savedHtmlScrollBehavior = html.style.scrollBehavior;

  // Disable smooth scrolling during lock/unlock so restoring the position
  // is instant and never animated.
  html.style.scrollBehavior = "auto";

  if (scrollbarWidth > 0) {
    const current = parseInt(getComputedStyle(body).paddingRight || "0", 10) || 0;
    body.style.paddingRight = `${current + scrollbarWidth}px`;
  }

  // position:fixed pattern — the only reliable way to preserve scroll
  // position on iOS Safari when the page is scroll-locked.
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = `-${savedScrollX}px`;
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  html.style.overflow = "hidden";
}

function release() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const body = document.body;
  const html = document.documentElement;

  // Restore every style property exactly as it was before engage().
  body.style.overflow = savedBodyOverflow;
  body.style.paddingRight = savedBodyPaddingRight;
  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.left = savedBodyLeft;
  body.style.right = savedBodyRight;
  body.style.width = savedBodyWidth;
  html.style.overflow = savedHtmlOverflow;

  // Restore the exact scroll position that was active at engage() time.
  // Must happen AFTER un-fixing the body, otherwise the scroll is a no-op.
  window.scrollTo(savedScrollX, savedScrollY);

  // Restore scroll-behavior last so any user-initiated scroll after this
  // point animates normally again.
  html.style.scrollBehavior = savedHtmlScrollBehavior;
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
