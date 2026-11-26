"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { DropSnapshot } from "@/lib/catalogue";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import Countdown from "./Countdown";
import BuyButton from "./BuyButton";
import DropAction from "./DropAction";
import SignalBackdrop from "./SignalBackdrop";
import { useLiveDrop } from "./useLiveDrop";
import styles from "./drop.module.css";

type Props = {
  initial: DropSnapshot;
  /** Each product's comic art by slug, where there is any. Found on the server. */
  art: Record<string, string | undefined>;
  /** And its 3D model, which art-flight.js fetches before leaving for the product. */
  models: Record<string, string | undefined>;
};

export default function DropView({ initial, art, models }: Props) {
  const t = useTranslations("drop");
  const { drop, now, stale } = useLiveDrop(initial);
  const total = drop.editions.reduce((sum, e) => sum + e.size, 0);
  const headStart = drop.earlyAccessAt && drop.publicAt ? Math.round((Date.parse(drop.publicAt) - Date.parse(drop.earlyAccessAt)) / 60000) : 0;
  const over = drop.state === "sold_out" || drop.state === "closed";
  const selling = drop.state === "public" || drop.state === "early_access";
  // before the opening, name both times: the landing counts to the public one
  const openings = drop.state === "scheduled" && drop.earlyAccessAt && drop.publicAt
    ? [["membersLabel", drop.earlyAccessAt], ["publicLabel", drop.publicAt]] as const : null;

  return (
    <div className={styles.page} data-bleed="" data-drop="">
      {/* one centred column, read top down: what it is, how long, what to do, then the small print */}
      <header className={styles.head}>
        <SignalBackdrop still className={styles.art} />
        <p className={styles.badge} role="status">{t(`state.${drop.state}`)}</p>
        <div className={styles.mast}>
          <h1 className={styles.title}>{drop.name}</h1>
          <p className={styles.aside}>{t("aside")}</p>
        </div>
        {drop.nextAt && !over && (
          <div className={styles.timing}>
            <p className={styles.until}>{t(`until.${drop.state}`)}</p>
            <div className={styles.clock}><Countdown to={drop.nextAt} now={now} label={t("countdown")} /></div>
          </div>
        )}
        {drop.state === "sold_out" && <p className={styles.soldOut}>{t("allFound", { total })}</p>}
        <div className={styles.act}>
          <DropAction state={drop.state} earlyAccessAt={drop.earlyAccessAt} publicAt={drop.publicAt} />
        </div>
        {openings ? (
          <div className={styles.print}>
            <dl className={styles.times}>
              {openings.map(([label, at]) => (
                <div key={label} data-next={at === drop.nextAt ? "" : undefined}><dt>{t(label)}</dt><dd>{formatDateTime(at)}</dd></div>
              ))}
            </dl>
            <p>{t("zone")}</p>
          </div>
        ) : drop.nextAt && !over && (
          <div className={styles.print}><p>{t(`next.${drop.state}`, { time: formatDateTime(drop.nextAt) })}</p></div>
        )}
        {stale && <p className={styles.stale} role="status">{t("stale")}</p>}
      </header>

      <h2 className={styles.heading}>{t("editionsHeading")}</h2>
      <ul className={styles.rows}>
        {drop.editions.map((e, i) => {
          const gone = e.left === 0;
          const buyable = selling && !gone;
          return (
            <li key={e.id} className={gone ? `${styles.row} ${styles.gone}` : styles.row} style={{ "--i": i } as React.CSSProperties}>
              <div className={styles.shot}>
                {art[e.slug]
                  // eslint-disable-next-line @next/next/no-img-element -- the art is already a sized webp
                  ? <img src={art[e.slug]} alt="" width={1344} height={768} />
                  : <span className={styles.blank} aria-hidden="true">{e.slug}</span>}
                {gone && <span className={styles.stamp}>{t("state.sold_out")}</span>}
              </div>
              <div className={styles.who}>
                <h3 className={styles.name}><Link href={`/p/${e.slug}`} data-model={models[e.slug]}>{e.name}</Link></h3>
                <span className={styles.meta}>{e.colour} · {t("numberRange", { from: unitNumber(1), to: unitNumber(e.size) })}</span>
              </div>
              <strong className={styles.price}>{formatVnd(e.priceVnd)}</strong>
              <div className={styles.stock}>
                <span>{t("leftOf", { left: e.left, size: e.size })}</span>
                {/* the landing's LED bar; the words above say the same */}
                <div className="stock-bar" aria-hidden="true"><span style={{ width: `${(e.left / e.size) * 100}%` }} /></div>
              </div>
              {buyable ? (
                <div className={`${styles.act} ${styles.buy}`}><BuyButton editionId={e.id} label={t("buyNow")} minutes={headStart} /></div>
              ) : (
                <svg className={styles.go} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h17M13 5l7 7-7 7" /></svg>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
