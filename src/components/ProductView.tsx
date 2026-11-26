"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DropSnapshot } from "@/lib/catalogue";
import { editionState } from "@/lib/drop-status";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import type { ProductContent } from "@/lib/product-content";
import type { Media } from "@/lib/product-media";
import Countdown from "./Countdown";
import DropAction from "./DropAction";
import ProductGallery from "./ProductGallery";
import { useLiveDrop } from "./useLiveDrop";
import styles from "./product.module.css";

type Props = {
  initial: DropSnapshot;
  slug: string;
  media: Media;
  content: ProductContent;
  openOnArt: boolean;
  /** The sections between the stage and the edition band. */
  children: React.ReactNode;
};

const SHADES: Record<string, string> = {
  Clear: "linear-gradient(160deg, #f4f2f8, #b9a4ff 55%, #f4f2f8)",
  Violet: "linear-gradient(160deg, #c9b8ff, #5b3fd1)",
  Black: "linear-gradient(160deg, #4a4756, #000)",
};

/** Everything on the product page that follows the live drop. One poll feeds the buy box and the edition band. */
export default function ProductView({ initial, slug, media, content, openOnArt, children }: Props) {
  const t = useTranslations("product");
  const d = useTranslations("drop");
  const { drop, now, stale } = useLiveDrop(initial);
  const editions = drop.editions.filter((e) => e.slug === slug);
  const [pickedId, setPickedId] = useState(editions[0]?.id);
  const picked = editions.find((e) => e.id === pickedId) ?? editions[0];
  if (!picked) return null;
  const state = editionState(drop.state, picked.left);
  const headStart = drop.earlyAccessAt && drop.publicAt
    ? Math.round((Date.parse(drop.publicAt) - Date.parse(drop.earlyAccessAt)) / 60000) : 0;
  const range = { from: unitNumber(1), to: unitNumber(picked.size) };

  return (
    <>
      <section className={styles.stage}>
        <div className={styles.cut} aria-hidden="true">
          <div className="wedge" />
          <div className="slash" />
          <div className="dots" />
        </div>
        <span className={`ghost ${styles.word}`} aria-hidden="true">{content.word}</span>

        <ProductGallery key={slug} media={media} name={picked.name} short={content.word} openOnArt={openOnArt} />

        <div className={styles.buy}>
          <h1 className={`slab ${styles.title}`}>{picked.name}</h1>
          <p className={styles.kind}>{content.kind}</p>
          <p className={styles.note}>{content.note}</p>

          <div className={styles.box}>
            <p className={styles.state} role="status">{drop.name} · {d(`state.${state}`)}</p>
            <div className={`stock ${styles.stock}`}>
              <p className="stock-text">{t("leftOf", { left: picked.left, size: picked.size })}</p>
              <div className="stock-bar" aria-hidden="true"><span style={{ width: `${(picked.left / picked.size) * 100}%` }} /></div>
            </div>
            <div className={styles.surface}>
              <fieldset className={styles.colours}>
                <legend>{t("colour")}</legend>
                {editions.map((e) => (
                  <label key={e.id} className={e.left === 0 ? styles.gone : undefined}>
                    <input type="radio" name="colour" checked={e.id === picked.id} onChange={() => setPickedId(e.id)} />
                    <i style={{ background: SHADES[e.colour] ?? "var(--grey)" }} aria-hidden="true" />
                    <span>{e.colour}</span>
                  </label>
                ))}
              </fieldset>
              <p className={styles.price}>{formatVnd(picked.priceVnd)}</p>
              <p className={styles.vat}>{t("vat")}</p>
            </div>
            <div className={styles.action}>
              <DropAction state={state} earlyAccessAt={drop.earlyAccessAt} publicAt={drop.publicAt} />
              {stale && <p role="status">{d("stale")}</p>}
            </div>
          </div>
        </div>
      </section>

      {children}

      <section className={styles.edition} aria-labelledby="edition-title">
        <span className={`ghost ${styles.editionGhost}`} aria-hidden="true">{drop.name}</span>
        <div className={styles.plate}>
          <p className={styles.plateLabel}>{t("numbered")}</p>
          <h2 id="edition-title" className={styles.range}>
            <span>{range.from}</span>
            <i aria-hidden="true" />
            <span className={styles.srOnly}> {t("to")} </span>
            <span>{range.to}</span>
          </h2>
          <ul className={styles.facts}>
            <li><strong>{picked.size.toLocaleString("en-US")}</strong>{t("factUnits")}</li>
            <li><strong>0</strong>{t("factRestocks")}</li>
            {headStart > 0 && <li><strong>{headStart}</strong>{t("factHeadStart")}</li>}
          </ul>
          {drop.nextAt && drop.state !== "sold_out" && drop.state !== "closed" && (
            <div className={styles.clock}>
              <p>{d(`next.${drop.state}`, { time: formatDateTime(drop.nextAt) })}</p>
              <Countdown to={drop.nextAt} now={now} label={d("countdown")} />
            </div>
          )}
        </div>
        <p className={styles.shout} aria-hidden="true">
          {t.rich("shout", {
            line: (words) => (
              <span className={styles.underlined}>
                {words}
                {/* one quick marker stroke and a shorter second pass */}
                <svg viewBox="0 0 200 20" preserveAspectRatio="none"><path pathLength={1} d="M3 11 C 55 6, 140 5, 197 8 M 22 17 C 80 12, 135 13, 176 14" /></svg>
              </span>
            ),
          })}
        </p>
      </section>
    </>
  );
}
