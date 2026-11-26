"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import type { Media } from "@/lib/product-media";
import styles from "./product.module.css";

type View = "photo" | "art" | "model";

// the custom element, written as a component so React accepts its ref and attributes
const ModelViewer = "model-viewer" as unknown as React.ElementType;

/** The parts of <model-viewer> that "Reset view" uses. */
type Viewer = HTMLElement & {
  cameraOrbit: string; cameraTarget: string; fieldOfView: string; resetTurntableRotation: () => void;
};

type Props = { media: Media; name: string; short: string; openOnArt: boolean };

/** The framed product on the stage: photo, comic illustration or 3D, whichever exist. */
export default function ProductGallery({ media, name, short, openOnArt }: Props) {
  const t = useTranslations("product");
  const views = (["photo", "art", "model"] as const).filter((view) => media[view]);
  const [picked, setPicked] = useState<View>(openOnArt && media.art ? "art" : (views[0] ?? "photo"));
  const [failed, setFailed] = useState(false);

  const viewer = useRef<Viewer | null>(null);
  const home = `30deg 72deg ${media.cameraDistance ?? "auto"}`;

  const resetView = () => {
    const element = viewer.current;
    if (!element) return;
    element.resetTurntableRotation();
    element.cameraTarget = "auto auto auto";
    element.fieldOfView = "auto";
    element.cameraOrbit = home;
  };

  // offline or a bad file: fall back to the first picture
  const fail = useCallback(() => { setFailed(true); setPicked("photo"); }, []);
  const watch = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    viewer.current = element as Viewer;
    element.addEventListener("error", fail);
    return () => { viewer.current = null; element.removeEventListener("error", fail); };
  }, [fail]);

  return (
    <div className={styles.gallery}>
      <div className={styles.rig}>
        <svg className={`starburst ${styles.burst}`} viewBox="0 0 200 200" aria-hidden="true"><polygon points={BURST} /></svg>
        <div className={styles.quad} aria-hidden="true" />
        <div data-art-frame className={picked === "art" ? `${styles.frame} ${styles.comic}` : styles.frame}>
          {picked === "model" && media.model ? (
            <>
              {/* the model file is large, so the viewer and the file load only when asked for */}
              <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js" onError={fail} />
              <ModelViewer ref={watch} {...{
                src: media.model, poster: media.photo, alt: t("modelAlt", { name }),
                // drag to turn, wheel or pinch to zoom, right-drag or two fingers to move; the page still scrolls
                "camera-controls": "", "touch-action": "pan-y", "interaction-prompt": "none",
                "environment-image": "neutral", exposure: "1.4", "shadow-intensity": "1",
                "camera-orbit": home, "min-camera-orbit": "auto 0deg 35%", "max-camera-orbit": `auto 180deg ${media.cameraDistance ? "220%" : "180%"}`,
                "min-field-of-view": "12deg", "zoom-sensitivity": "1.3",
              }}>
                {/* replaces the invisible 8px pan handle at the centre, which swallowed drags that started on it */}
                <span slot="pan-target" />
              </ModelViewer>
              <button type="button" className={styles.reset} onClick={resetView} aria-label={t("resetView")} title={t("resetView")}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M6.4 2.5v4.2h4.2" /></svg>
              </button>
            </>
          ) : media[picked] ? (
            // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
            <img key={picked} src={media[picked]} alt={t(picked === "art" ? "artAlt" : "photoAlt", { name })} />
          ) : (
            // no media yet: the name and a drawn cable carry the stage
            <div className={styles.blank} role="img" aria-label={t("noPhoto")}>
              <svg viewBox="0 0 400 220" aria-hidden="true"><path d="M-10 150 C 70 20, 150 220, 215 110 S 330 30, 410 90" /></svg>
              <span>{short}</span>
            </div>
          )}
        </div>
        <span className={styles.sticker} aria-hidden="true">{short}</span>
      </div>
      {views.length > 1 && (
        <div className={styles.switcher} role="group" aria-label={t("views")}>
          {views.map((view) => (
            <button key={view} type="button" aria-pressed={picked === view} onClick={() => { setFailed(false); setPicked(view); }}>
              <span>{t(`view.${view}`)}</span>
            </button>
          ))}
        </div>
      )}
      {failed && <p role="alert" className={styles.alert}>{t("modelFailed")}</p>}
    </div>
  );
}

// the landing's 24-point burst
const BURST = Array.from({ length: 48 }, (_, i) => {
  const angle = (i * Math.PI) / 24;
  const radius = i % 2 ? 76 : 96;
  return `${(100 + radius * Math.sin(angle)).toFixed(1)},${(100 - radius * Math.cos(angle)).toFixed(1)}`;
}).join(" ");
