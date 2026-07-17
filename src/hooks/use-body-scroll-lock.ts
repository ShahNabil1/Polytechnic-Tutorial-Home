import { useEffect } from "react";

/**
 * Locks background page scroll while `active` is true.
 * Preserves the current scroll position and restores it on unlock,
 * so mobile drawers/menus don't cause layout jumps.
 *
 * Safe to nest — uses a ref-count on the html element so multiple
 * concurrent locks don't clobber each other.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    // Ref-count so multiple concurrent locks compose cleanly.
    const currentCount = Number(html.dataset.scrollLockCount ?? "0");
    html.dataset.scrollLockCount = String(currentCount + 1);

    // Only capture the original styles on the first lock.
    if (currentCount === 0) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      html.dataset.scrollLockY = String(scrollY);

      html.dataset.prevOverflow = html.style.overflow;
      html.dataset.prevBodyOverflow = body.style.overflow;
      html.dataset.prevBodyPosition = body.style.position;
      html.dataset.prevBodyTop = body.style.top;
      html.dataset.prevBodyWidth = body.style.width;

      // Compensate for the disappearing scrollbar so the page doesn't shift.
      const scrollbarWidth = window.innerWidth - html.clientWidth;
      if (scrollbarWidth > 0) {
        html.dataset.prevPaddingRight = body.style.paddingRight;
        body.style.paddingRight = `${scrollbarWidth}px`;
      }

      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      // iOS Safari needs position: fixed to actually stop rubber-band scroll.
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
    }

    return () => {
      const count = Number(html.dataset.scrollLockCount ?? "1") - 1;
      if (count > 0) {
        html.dataset.scrollLockCount = String(count);
        return;
      }
      delete html.dataset.scrollLockCount;

      const scrollY = Number(html.dataset.scrollLockY ?? "0");

      html.style.overflow = html.dataset.prevOverflow ?? "";
      body.style.overflow = html.dataset.prevBodyOverflow ?? "";
      body.style.position = html.dataset.prevBodyPosition ?? "";
      body.style.top = html.dataset.prevBodyTop ?? "";
      body.style.width = html.dataset.prevBodyWidth ?? "";
      if (html.dataset.prevPaddingRight !== undefined) {
        body.style.paddingRight = html.dataset.prevPaddingRight;
      }

      delete html.dataset.scrollLockY;
      delete html.dataset.prevOverflow;
      delete html.dataset.prevBodyOverflow;
      delete html.dataset.prevBodyPosition;
      delete html.dataset.prevBodyTop;
      delete html.dataset.prevBodyWidth;
      delete html.dataset.prevPaddingRight;

      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
