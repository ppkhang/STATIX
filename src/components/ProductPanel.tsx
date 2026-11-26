"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DropSnapshot } from "@/lib/catalogue";
import { editionState } from "@/lib/drop-status";
import { formatVnd } from "@/lib/format";
import DropAction from "./DropAction";
import LeftBar from "./LeftBar";
import { useLiveDrop } from "./useLiveDrop";
import styles from "./catalogue.module.css";

/** Colour, price, live count and main button. Each colour is its own edition (FR-003). */
export default function ProductPanel({ initial, slug }: { initial: DropSnapshot; slug: string }) {
  const t = useTranslations("product");
  const d = useTranslations("drop");
  const { drop, stale } = useLiveDrop(initial);
  const editions = drop.editions.filter((e) => e.slug === slug);
  const [pickedId, setPickedId] = useState(editions[0]?.id);
  const picked = editions.find((e) => e.id === pickedId) ?? editions[0];
  if (!picked) return null;
  const state = editionState(drop.state, picked.left);

  return (
    <div className={styles.panel}>
      <p className={styles.badge} role="status">{drop.name} · {d(`state.${state}`)}</p>
      <fieldset className={styles.colours}>
        <legend>{t("colour")}</legend>
        {editions.map((e) => (
          <label key={e.id} className={e.left === 0 ? styles.crossed : undefined}>
            <input type="radio" name="colour" checked={e.id === picked.id} onChange={() => setPickedId(e.id)} />
            {e.colour}
          </label>
        ))}
      </fieldset>
      <LeftBar left={picked.left} size={picked.size} />
      <p className={styles.price}>{formatVnd(picked.priceVnd)}</p>
      <p>{t("vat")}</p>
      <DropAction state={state} earlyAccessAt={drop.earlyAccessAt} publicAt={drop.publicAt} />
      {stale && <p role="status">{d("stale")}</p>}
    </div>
  );
}
