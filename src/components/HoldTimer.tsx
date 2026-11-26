"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./checkout.module.css";

/**
 * "Your No. 042 / 500 is held for 9:41". Counted from the server's clock (`now` as it rendered), so a wrong clock on
 * this computer changes nothing. At zero the page asks the server again, which has already let the unit go.
 */
export default function HoldTimer({ unit, expiresAt, now }: { unit: string; expiresAt: string; now: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const total = Math.max(0, Math.round((Date.parse(expiresAt) - Date.parse(now)) / 1000));
  const [gone, setGone] = useState(0);

  useEffect(() => {
    const started = performance.now();
    const tick = setInterval(() => setGone(Math.floor((performance.now() - started) / 1000)), 250);
    return () => clearInterval(tick);
  }, [expiresAt, now]);

  const left = Math.max(0, total - gone);
  const over = left === 0;
  useEffect(() => { if (over) router.refresh(); }, [over, router]);

  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <>
      <p className={styles.timer} aria-live="off">
        {t.rich("held", { unit, time: () => <strong>{clock}</strong> })}
      </p>
      {/* a screen reader hears the minute marks, not every second */}
      <p className={styles.srOnly} role="status">{left > 0 && left <= 120 && left % 60 < 1 ? t("minutesLeft", { minutes: Math.ceil(left / 60) }) : ""}</p>
    </>
  );
}
