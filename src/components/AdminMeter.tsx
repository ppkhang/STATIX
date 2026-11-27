import styles from "./admin.module.css";

type Props = { size: number; sold: number; held?: number; retired?: number };

/** A run of numbered units as one bar. Hidden from screen readers: the same numbers are always written beside it. */
export default function AdminMeter({ size, sold, held = 0, retired = 0 }: Props) {
  return (
    <div className={styles.meter} aria-hidden="true">
      {([["sold", sold], ["held", held], ["retired", retired]] as const).map(([part, units]) => (
        // a few units in a big run still get a sliver
        units > 0 && <i key={part} data-part={part} style={{ width: `max(3px, ${(units / Math.max(size, 1)) * 100}%)` }} />
      ))}
    </div>
  );
}
