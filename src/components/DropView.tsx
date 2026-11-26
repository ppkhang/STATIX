"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { DropSnapshot } from "@/lib/catalogue";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import Countdown from "./Countdown";
import BuyButton from "./BuyButton";
import DropAction from "./DropAction";
import LeftBar from "./LeftBar";
import { useLiveDrop } from "./useLiveDrop";
import styles from "./catalogue.module.css";

export default function DropView({ initial }: { initial: DropSnapshot }) {
  const t = useTranslations("drop");
  const { drop, now, stale } = useLiveDrop(initial);
  const total = drop.editions.reduce((sum, e) => sum + e.size, 0);
  const headStart = drop.earlyAccessAt && drop.publicAt ? Math.round((Date.parse(drop.publicAt) - Date.parse(drop.earlyAccessAt)) / 60000) : 0;

  return (
    <>
      <h1>{drop.name}</h1>
      <p className={styles.badge} role="status">{t(`state.${drop.state}`)}</p>
      {drop.nextAt && drop.state !== "sold_out" && drop.state !== "closed" && (
        <>
          {/* before the opening, name both times: the landing counts to the public one */}
          {drop.state === "scheduled" && drop.earlyAccessAt && drop.publicAt ? (
            <>
              <p>{t("membersOpen", { time: formatDateTime(drop.earlyAccessAt) })}</p>
              <p>{t("publicOpen", { time: formatDateTime(drop.publicAt) })}</p>
            </>
          ) : (
            <p>{t(`next.${drop.state}`, { time: formatDateTime(drop.nextAt) })}</p>
          )}
          <Countdown to={drop.nextAt} now={now} label={t("countdown")} />
        </>
      )}
      {drop.state === "sold_out" && <p className={styles.soldOut}>{t("allFound", { total })}</p>}
      <DropAction state={drop.state} earlyAccessAt={drop.earlyAccessAt} publicAt={drop.publicAt} />
      {stale && <p role="status">{t("stale")}</p>}

      <ul className={styles.rows}>
        {drop.editions.map((e) => (
          <li key={e.id} className={e.left === 0 ? styles.gone : undefined}>
            <div>
              <h2><Link href={`/p/${e.slug}`}>{e.name}</Link></h2>
              <span>{e.colour} · {t("numberRange", { from: unitNumber(1), to: unitNumber(e.size) })}</span>
            </div>
            <strong>{formatVnd(e.priceVnd)}</strong>
            <LeftBar left={e.left} size={e.size} />
            {(drop.state === "public" || drop.state === "early_access") && e.left > 0 && (
              <div className={styles.rowBuy}><BuyButton editionId={e.id} label={t("buyNow")} minutes={headStart} /></div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
