import { useTranslations } from "next-intl";
import styles from "./catalogue.module.css";

export default function Countdown({ to, now, label }: { to: string; now: number; label: string }) {
  const t = useTranslations("drop");
  const total = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const parts = [
    ["days", Math.floor(total / 86400)],
    ["hours", Math.floor(total / 3600) % 24],
    ["minutes", Math.floor(total / 60) % 60],
    ["seconds", total % 60],
  ] as const;

  return (
    <div className={styles.countdown} role="timer" aria-label={label} aria-live="off">
      {parts.map(([unit, value]) => (
        <div key={unit}>
          <span className={styles.digit}>{String(value).padStart(2, "0")}</span>
          <span className={styles.unit}>{t(unit)}</span>
        </div>
      ))}
    </div>
  );
}
