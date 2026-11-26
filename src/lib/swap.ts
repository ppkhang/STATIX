/** +1 is forward through the tabs, -1 back. */
export type Direction = 1 | -1;

// the frame leaves, then the next arrives: 400 ms in all
const LEAVE_MS = 100;
const ENTER_MS = 300;
const SLIDE = 48; // px: enough to read as a direction

/** Reduced motion, or the site's motion toggle (html.paused): change with no slides or sweeps. */
export const calm = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("paused");

/**
 * The old content leaves the way you're going, `swap` changes it, and the new content comes in from the other
 * side. Only translate and opacity move, so a tilt held in `transform` stays. Calling it again cancels the
 * one in progress, so the latest press wins.
 */
export async function slideSwap(element: HTMLElement | null, direction: Direction, swap: () => void) {
  element?.getAnimations().forEach((animation) => animation.cancel());
  if (!element || calm()) return swap();
  const leaving = element.animate(
    [{ translate: "0 0", opacity: 1 }, { translate: `${-SLIDE * direction}px 0`, opacity: 0 }],
    { duration: LEAVE_MS, easing: "ease-in", fill: "forwards" },
  );
  try { await leaving.finished; } catch { return; } // cancelled by a newer press
  swap();
  leaving.cancel();
  element.animate(
    [{ translate: `${SLIDE * direction}px 0`, opacity: 0 }, { translate: "0 0", opacity: 1 }],
    { duration: ENTER_MS, easing: "cubic-bezier(.2, 1.2, .35, 1)" },
  );
}

/** Right and ] go forward, Left and [ back. Anything else, or with a modifier held, is 0. */
export const arrowStep = (event: { key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }) =>
  event.altKey || event.ctrlKey || event.metaKey ? 0
    : event.key === "ArrowRight" || event.key === "]" ? 1
      : event.key === "ArrowLeft" || event.key === "[" ? -1 : 0;
