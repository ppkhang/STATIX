"use client";

import { createElement, useCallback, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { productMedia } from "@/lib/product-media";
import styles from "./catalogue.module.css";

type View = "photo" | "art" | "model";
const VIEWS: View[] = ["photo", "art", "model"];

export default function ProductGallery({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("product");
  const media = productMedia[slug];
  const [view, setView] = useState<View>("photo");
  const [failed, setFailed] = useState(false);

  // offline or a bad file: fall back to the photo
  const fail = useCallback(() => { setFailed(true); setView("photo"); }, []);
  const watch = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.addEventListener("error", fail);
    return () => element.removeEventListener("error", fail);
  }, [fail]);

  if (!media) return <div className={`${styles.shot} ${styles.noShot}`}>{t("noPhoto")}</div>;

  return (
    <div className={styles.gallery}>
      <div className={styles.shot}>
        {view === "model" ? (
          <>
            {/* the model is up to 20 MB, so the viewer and the file load only when asked for */}
            <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js" onError={fail} />
            {createElement("model-viewer", {
              ref: watch, src: media.model, poster: media.photo, alt: t("modelAlt", { name }),
              "camera-controls": "", "disable-zoom": "", "disable-pan": "", "touch-action": "pan-y",
              "environment-image": "neutral", exposure: "1.4",
              ...(media.cameraDistance && {
                "camera-orbit": `30deg 72deg ${media.cameraDistance}`, "max-camera-orbit": `auto auto ${media.cameraDistance}`,
              }),
            })}
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
          <img src={view === "art" ? media.art : media.photo} alt={t(view === "art" ? "artAlt" : "photoAlt", { name })} />
        )}
      </div>
      <div className={styles.thumbs} role="group" aria-label={t("views")}>
        {VIEWS.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => { setFailed(false); setView(v); }}>
            {t(`view.${v}`)}
          </button>
        ))}
      </div>
      {failed && <p role="alert">{t("modelFailed")}</p>}
    </div>
  );
}
