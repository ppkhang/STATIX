"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import styles from "./toast.module.css";

const SHOW_MS = 6000;
const LEAVE_MS = 200; // as long as the exit in toast.module.css

/**
 * The shout: a leaning purple "!" cut like the cutout letters, with a black keyline and a hard shadow, over a small
 * starburst. Each part has its own entrance (toast.module.css). Decoration: the words say everything.
 */
function Mark() {
  const bar = "M19 5 L34 4 L27 29 L20 29 Z";
  const dot = "M18 33 L28 32 L27 42 L17 43 Z";
  return (
    <svg className={styles.mark} viewBox="0 0 48 48" aria-hidden="true">
      <polygon className={styles.burst} points="24,0 29,11 41,7 37,19 48,24 37,29 41,41 29,37 24,48 19,37 7,41 11,29 0,24 11,19 7,7 19,11" />
      <g className={styles.bar}><path className={styles.shadow} d={bar} /><path className={styles.ink} d={bar} /></g>
      <g className={styles.dot}><path className={styles.shadow} d={dot} /><path className={styles.ink} d={dot} /></g>
    </svg>
  );
}

type Props = {
  message: string;
  /** "bad" is for something that didn't go through. It stays until dismissed. */
  tone?: "good" | "bad";
  /** The query parameter that asked for this, taken out of the address so a reload doesn't say it again. */
  param: string;
};

/**
 * Says that something just happened. Give it a fresh `key` each time the page is drawn, so doing the same thing
 * twice says so twice. Form errors don't belong here: they stay next to their fields.
 */
export default function Toast({ message, tone = "good", param }: Props) {
  const t = useTranslations("toast");
  // the live region has to be in the page before the words are, or a screen reader may not say them
  const [stage, setStage] = useState<"off" | "region" | "said" | "leaving" | "gone">("off");
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", url);
    const timers = [setTimeout(() => setStage("region"), 0), setTimeout(() => setStage("said"), 120)];
    return () => timers.forEach(clearTimeout);
  }, [param]);

  // hovering or focusing it stops the clock; leaving starts it again from the top (WCAG 2.2.1)
  const counting = stage === "said" && tone === "good" && !held;
  useEffect(() => {
    if (!counting) return;
    const timer = setTimeout(() => setStage("leaving"), SHOW_MS);
    return () => clearTimeout(timer);
  }, [counting]);

  // dismissed or timed out: it snaps back into its tail before it goes. Timed, not waiting on the animation to end,
  // because with reduced motion there is no animation
  useEffect(() => {
    if (stage !== "leaving") return;
    const timer = setTimeout(() => setStage("gone"), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  // gone the moment you leave: what it says belongs to this page, and it mustn't sit over the wipe to the next one.
  // On window and capturing, so it hears the click before the transition script takes it over
  useEffect(() => {
    const leaving = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      // a new tab, a download or a jump within the page leaves you where you are
      if (!link || link.target || link.download || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.pathname !== window.location.pathname) setStage("gone");
    };
    const back = () => setStage("gone");
    window.addEventListener("click", leaving, true);
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("click", leaving, true);
      window.removeEventListener("popstate", back);
    };
  }, []);

  if (stage === "off" || stage === "gone") return null;
  // in the body, so no page's own stacking or clipping can hide it
  return createPortal(
    <div className={styles.region} role={tone === "bad" ? "alert" : "status"}>
      {(stage === "said" || stage === "leaving") && (
        <div
          className={styles.toast} data-tone={tone} data-leaving={stage === "leaving" || undefined}
          onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}
          onKeyDown={(event) => { if (event.key === "Escape") setStage("leaving"); }}
        >
          {/* the bubble, back to front: its shadow (the card's ::before), the white edge, the dark inside */}
          <i className={styles.edge} aria-hidden="true" />
          <i className={styles.fill} aria-hidden="true" />
          <Mark />
          <p>{message}</p>
          <button type="button" className={styles.close} onClick={() => setStage("leaving")} aria-label={t("close")}>×</button>
          {/* how long is left; mounted only while counting, so it restarts with the clock */}
          {counting && <span className={styles.rail} aria-hidden="true"><i className={styles.timer} style={{ animationDuration: `${SHOW_MS}ms` }} /></span>}
        </div>
      )}
    </div>,
    document.body,
  );
}
