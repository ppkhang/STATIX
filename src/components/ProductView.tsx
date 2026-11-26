"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import type { DropSnapshot } from "@/lib/catalogue";
import { editionState } from "@/lib/drop-status";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import type { ProductContent } from "@/lib/product-content";
import type { Media } from "@/lib/product-media";
import { arrowStep, slideSwap } from "@/lib/swap";
import Countdown from "./Countdown";
import DropAction from "./DropAction";
import ProductGallery, { type Showcase } from "./ProductGallery";
import { useLiveDrop } from "./useLiveDrop";
import styles from "./product.module.css";

type Tab = "buy" | "close" | "specs" | "run";

type Props = {
  initial: DropSnapshot;
  slug: string;
  media: Media;
  content: ProductContent;
  /** Tab contents built on the server. A tab with nothing to show is left out. */
  closeUps: React.ReactNode;
  /** The two scrolling bands behind the screen. */
  bands: React.ReactNode;
  specs: React.ReactNode;
  /** The other products, as icons along the bottom. */
  roster: React.ReactNode;
};

const SHADES: Record<string, string> = {
  Clear: "linear-gradient(160deg, #f4f2f8, #b9a4ff 55%, #f4f2f8)",
  Violet: "linear-gradient(160deg, #c9b8ff, #5b3fd1)",
  Black: "linear-gradient(160deg, #4a4756, #000)",
};

/**
 * One screen: the product on display on the left, and everything about it in tabs on the right.
 * A single poll feeds the buy box and the edition panel.
 */
export default function ProductView({ initial, slug, media, content, closeUps, specs, roster, bands }: Props) {
  const t = useTranslations("product");
  const d = useTranslations("drop");
  const { drop, now, stale } = useLiveDrop(initial);
  const editions = drop.editions.filter((e) => e.slug === slug);
  const [pickedId, setPickedId] = useState(editions[0]?.id);
  const [tab, setTab] = useState<Tab>("buy");
  const [wanted, setWanted] = useState<Tab>("buy");
  const [said, setSaid] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const showcase = useRef<Showcase>(null);
  const buttons = useRef(new Map<Tab, HTMLButtonElement>());
  const picked = editions.find((e) => e.id === pickedId) ?? editions[0];

  const tabs: Tab[] = (["buy", "close", "specs", "run"] as const).filter((key) => key !== "close" || closeUps);

  const open = (next: Tab) => {
    if (next === wanted) return;
    const direction = tabs.indexOf(next) > tabs.indexOf(wanted) ? 1 : -1;
    setWanted(next);
    setSaid(t("tabShown", { tab: t(`tabs.${next}`) }));
    slideSwap(body.current, direction, () => flushSync(() => setTab(next)));
    showcase.current?.turnTo(next, direction); // the model turns the way the tabs went
  };
  const step = (by: number, focus: boolean) => {
    const next = tabs[tabs.indexOf(wanted) + by]; // stops at the ends, so forward always means forward
    if (!next) return;
    if (focus) buttons.current.get(next)?.focus();
    open(next);
  };

  if (!picked) return null;
  const state = editionState(drop.state, picked.left);
  const headStart = drop.earlyAccessAt && drop.publicAt
    ? Math.round((Date.parse(drop.publicAt) - Date.parse(drop.earlyAccessAt)) / 60000) : 0;
  const range = { from: unitNumber(1), to: unitNumber(picked.size) };
  const times = [
    ...(drop.earlyAccessAt ? [[t("membersOpens"), formatDateTime(drop.earlyAccessAt)]] : []),
    ...(drop.publicAt ? [[t("publicOpens"), formatDateTime(drop.publicAt)]] : []),
  ];
  // only what the live data and the images confirm; measured specs come from product-content.ts
  const glance: string[][] = [
    ...(content.kind ? [[t("type"), content.kind]] : []),
    [t("colour"), editions.map((e) => e.colour).join(", ")],
    [t("editionSize"), picked.size.toLocaleString("en-US")],
    [t("numbers"), `${range.from}–${range.to}`],
    [t("restocks"), t("none")],
    [t("price"), `${formatVnd(picked.priceVnd)} · ${t("vatShort")}`],
    ...(headStart > 0 ? [[t("headStart"), t("minutes", { minutes: headStart })]] : []),
    ...times,
  ];
  const facts = (rows: string[][]) => (
    <dl className={styles.glance}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  );
  // every panel stays in the page, stacked in one cell, so the column never changes height between tabs
  const panel = (key: Tab, children: React.ReactNode) => (
    <div id={`panel-${key}`} className={styles.pane} data-active={tab === key ? "" : undefined}>{children}</div>
  );

  return (
    <section className={styles.stage}>
      <div className={styles.cut} aria-hidden="true">
        <div className="dots" />
      </div>
      {bands}
      <span className={`ghost ${styles.word}`} aria-hidden="true">{content.word}</span>

      <ProductGallery key={slug} media={media} name={picked.name} short={content.word} control={showcase} />

      <div className={styles.buy}>
        <h1 className={`slab ${styles.title}`}>{picked.name}</h1>

        {/* the frame stays put; only what's inside it moves, cut off at its edges */}
        <div className={styles.panes}>
          <div ref={body} className={styles.reel}>
          {panel("buy", (
            <>
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
                  <DropAction state={state} earlyAccessAt={drop.earlyAccessAt} publicAt={drop.publicAt} editionId={picked.id} />
                  {stale && <p role="status">{d("stale")}</p>}
                </div>
                {facts([[t("numbers"), `${range.from}–${range.to}`], [t("restocks"), t("none")], ...times])}
              </div>
            </>
          ))}
          {closeUps && panel("close", closeUps)}
          {panel("specs", <>{facts(glance)}{specs}</>)}
          {panel("run", (
            <>
              <div className={styles.plate}>
                <p className={styles.plateLabel}>{t("numbered")}</p>
                <h2 className={styles.range}>
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
                      <svg viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M3 11 C 55 6, 140 5, 197 8 M 22 17 C 80 12, 135 13, 176 14" /></svg>
                    </span>
                  ),
                })}
              </p>
            </>
          ))}
          </div>
        </div>

        {/* under the panels; the arrow keys and [ ] step through it when it has focus */}
        <div
          className={styles.index} role="group" aria-label={t("tabsLabel")}
          onKeyDown={(event) => { const by = arrowStep(event); if (by) { event.preventDefault(); step(by, true); } }}
        >
          {tabs.map((key) => (
            <button
              key={key} type="button" aria-pressed={wanted === key} aria-controls={`panel-${key}`} onClick={() => open(key)}
              ref={(element) => { if (element) buttons.current.set(key, element); else buttons.current.delete(key); }}
            >
              <span>{t(`tabs.${key}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {roster}
      <p className={styles.srOnly} role="status">{said}</p>
    </section>
  );
}
