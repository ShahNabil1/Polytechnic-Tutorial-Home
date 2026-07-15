import { useEffect } from "react";

/**
 * Global reference-counted body scroll lock that also preserves the exact
 * scroll position across open/close cycles (including iOS Safari, where a
 * plain `overflow: hidden` on body can jump the page to the top).
 *
 * Mobile/iOS specific handling:
 *   - `position: fixed` on <body> preserves exact scroll position on iOS
 *     Safari, where `overflow: hidden` alone jumps the page to the top when
 *     the address bar hides/shows.
 *   - `overscroll-behavior: none` on <html> and <body> prevents rubber-band
 *     bounce from bleeding through to the underlying page.
 *   - A `touchmove` capture listener blocks background scroll for any touch
 *     that doesn't originate inside a scrollable region of the modal, which
 *     is the last remaining scroll-leak vector on iOS < 16.
 *   - The saved viewport width is pinned so the body doesn't reflow when the
 *     iOS address bar toggles while the lock is engaged.
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
let savedBodyOverscroll = "";
let savedBodyTouchAction = "";
let savedHtmlOverflow = "";
let savedHtmlOverscroll = "";
let savedHtmlScrollBehavior = "";

const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; disambiguate with touch support.
    (ua.includes("Mac") && "ontouchend" in document)
  );
};

/**
 * Blocks touchmove events that would scroll the background. Any touch that
 * originates inside an element with `[data-scroll-lock-allow]`, or inside a
 * naturally scrollable element that still has room to scroll, is allowed
 * through. Everything else is prevented.
 */
function onTouchMoveCapture(e: TouchEvent) {
  const target = e.target as Element | null;
  if (!target) return;

  // Multi-touch (pinch-zoom) always allowed.
  if (e.touches.length > 1) return;

  let node: Element | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      if (node.dataset.scrollLockAllow !== undefined) return;
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const scrollable =
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight;
      if (scrollable) {
        // Prevent iOS's `body scroll leak` at the top / bottom of a
        // scrollable region by nudging the container 1px away from the edge.
        if (node.scrollTop <= 0) node.scrollTop = 1;
        else if (node.scrollTop + node.clientHeight >= node.scrollHeight) {
          node.scrollTop = node.scrollHeight - node.clientHeight - 1;
        }
        return;
      }
    }
    node = node.parentElement;
  }

  if (e.cancelable) e.preventDefault();
}

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
  savedBodyOverscroll = body.style.overscrollBehavior;
  savedBodyTouchAction = body.style.touchAction;
  savedHtmlOverflow = html.style.overflow;
  savedHtmlOverscroll = html.style.overscrollBehavior;
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
  // Pin width against the current viewport so iOS address-bar toggles don't
  // reflow the underlying page while the lock is active.
  body.style.width = "100%";
  body.style.overflow = "hidden";

  // Kill rubber-band bounce that leaks through to the underlying page.
  body.style.overscrollBehavior = "none";
  html.style.overscrollBehavior = "none";
  html.style.overflow = "hidden";

  // iOS 15 and earlier ignore `overscroll-behavior` on <body>; catch those
  // events at the document level so the modal contents can still scroll but
  // the underlying page cannot.
  if (isIOS()) {
    body.style.touchAction = "none";
    document.addEventListener("touchmove", onTouchMoveCapture, {
      passive: false,
      capture: true,
    });
  }
}

function release() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  const body = document.body;
  const html = document.documentElement;

  if (isIOS()) {
    document.removeEventListener("touchmove", onTouchMoveCapture, {
      capture: true,
    } as EventListenerOptions);
  }

  // Restore every style property exactly as it was before engage().
  body.style.overflow = savedBodyOverflow;
  body.style.paddingRight = savedBodyPaddingRight;
  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.left = savedBodyLeft;
  body.style.right = savedBodyRight;
  body.style.width = savedBodyWidth;
  body.style.overscrollBehavior = savedBodyOverscroll;
  body.style.touchAction = savedBodyTouchAction;
  html.style.overflow = savedHtmlOverflow;
  html.style.overscrollBehavior = savedHtmlOverscroll;

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
