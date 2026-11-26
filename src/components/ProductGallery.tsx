"use client";

import { useCallback, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import type { Media } from "@/lib/product-media"; // types only: that file reads the disk, so it stays on the server
import { calm, type Direction } from "@/lib/swap";
import styles from "./product.module.css";

/** What the page's tabs use to turn the model. */
export type Showcase = { turnTo: (tab: string, direction: Direction) => void };

// the custom element, written as a component so React accepts its ref and attributes
const ModelViewer = "model-viewer" as unknown as React.ElementType;

/** The parts of <model-viewer> the camera moves use. */
type Viewer = HTMLElement & {
  cameraOrbit: string; cameraTarget: string; fieldOfView: string; interpolationDecay: number;
  updateComplete?: Promise<unknown>;
  getCameraOrbit?: () => { theta: number };
  jumpCameraToGoal: () => void;
  resetTurntableRotation: () => void;
};

const MOVE_DECAY = 55; // model-viewer's easing time for a tab turn, done within 500 ms (higher is slower)
const DRAG_DECAY = 50; // its default, put back for dragging
const LONGEST_LEG = 150; // degrees: safely under the half circle where "shorter way round" flips

type Props = { media: Media; name: string; short: string; control?: React.Ref<Showcase> };

/** The product on the stage, in 3D; while it loads only the frosted burst shows. With no model (or a failed one) the photo or the name stands in. */
export default function ProductGallery({ media, name, short, control }: Props) {
  const t = useTranslations("product");
  const [failed, setFailed] = useState(false);
  const viewer = useRef<Viewer | null>(null);
  const restore = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopSteering = useRef<() => void>(undefined);
  const home = media.angles.buy ?? "30deg 72deg 116%";

  /** Sends the camera somewhere: eased, or at once when motion should be still. */
  const move = useCallback((element: Viewer, orbit: string) => {
    clearTimeout(restore.current);
    element.interpolationDecay = MOVE_DECAY;
    element.cameraOrbit = orbit;
    if (calm()) (element.updateComplete ?? Promise.resolve()).then(() => element.jumpCameraToGoal());
    restore.current = setTimeout(() => { element.interpolationDecay = DRAG_DECAY; }, 500);
  }, []);

  /** Each tab has its own angle and zoom. Forward turns one way and back the other, even when the other way round is shorter. */
  useImperativeHandle(control, () => ({
    turnTo(tab, direction) {
      const element = viewer.current;
      const angle = media.angles[tab];
      if (!element || !angle) return;
      stopSteering.current?.();
      // the library may still be loading: leave the angle on the element for it to start from
      if (!element.getCameraOrbit) return element.setAttribute("camera-orbit", angle);
      const [turn, tilt, distance] = angle.split(" ");
      const heading = () => (element.getCameraOrbit!().theta * 180) / Math.PI;
      // how far there still is to go, travelling this way round; a hair short of a full circle means we're there
      const left = () => {
        const ahead = ((((parseFloat(turn) - heading()) * direction) % 360) + 360) % 360;
        return ahead > 359 ? ahead - 360 : ahead;
      };
      const aim = (degrees: number) => move(element, `${(heading() + degrees * direction).toFixed(2)}deg ${tilt} ${distance}`);
      element.resetTurntableRotation();
      element.cameraTarget = "auto auto auto";
      if (calm() || left() <= LONGEST_LEG) return aim(left());
      // model-viewer takes the shorter way round, so a long turn keeps the aim less than half a circle ahead of
      // wherever the camera really is, until what's left is short enough to ask for outright
      const steer = () => {
        const remaining = left();
        if (remaining > LONGEST_LEG) return aim(LONGEST_LEG);
        stopSteering.current?.();
        aim(remaining);
      };
      element.addEventListener("camera-change", steer);
      stopSteering.current = () => element.removeEventListener("camera-change", steer);
      aim(LONGEST_LEG);
    },
  }), [media.angles, move]);

  // offline or a bad file: fall back to the photo
  const fail = useCallback(() => setFailed(true), []);

  const watch = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    viewer.current = element as Viewer;
    const grab = () => stopSteering.current?.();
    element.addEventListener("pointerdown", grab);
    element.addEventListener("error", fail);
    return () => {
      viewer.current = null;
      clearTimeout(restore.current);
      stopSteering.current?.();
      element.removeEventListener("pointerdown", grab);
      element.removeEventListener("error", fail);
    };
  }, [fail]);

  return (
    <div className={styles.gallery}>
      <div className={styles.rig}>
        <div className={styles.burst} style={{ clipPath: BURST }} aria-hidden="true" />
        <div data-art-frame className={styles.frame}>
          {media.model && !failed ? (
            <>
              {/* the viewer and model load only on a page that shows 3D */}
              <Script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js" onError={fail} />
              <ModelViewer ref={watch} {...{
                src: media.model, alt: t("modelAlt", { name }),
                // drag to turn only: the tabs do the zooming, so the visitor can't push the model out of view
                "camera-controls": "", "disable-zoom": "", "disable-pan": "", "disable-tap": "", "touch-action": "pan-y", "interaction-prompt": "none",
                "environment-image": "neutral", exposure: "1.4", "shadow-intensity": "1",
                "camera-orbit": home, "min-camera-orbit": "auto 0deg 65%", "max-camera-orbit": "auto 180deg 200%",
              }}>
                {/* no loading bar */}
                <span slot="progress-bar" />
                {/* replaces the invisible 8px pan handle at the centre, which swallowed drags that started on it */}
                <span slot="pan-target" />
              </ModelViewer>
            </>
          ) : media.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
            <img src={media.photo} alt={t("photoAlt", { name })} />
          ) : (
            // no media yet: the name and a drawn cable carry the stage
            <div className={styles.blank} role="img" aria-label={t("noPhoto")}>
              <svg viewBox="0 0 400 220" aria-hidden="true"><path d="M-10 150 C 70 20, 150 220, 215 110 S 330 30, 410 90" /></svg>
              <span>{short}</span>
            </div>
          )}
        </div>
      </div>
      {failed && <p role="alert" className={styles.alert}>{t("modelFailed")}</p>}
    </div>
  );
}

// the landing's 24-point burst, as a shape to clip the frosted pane to
const BURST = `polygon(${Array.from({ length: 48 }, (_, i) => {
  const angle = (i * Math.PI) / 24;
  const radius = i % 2 ? 38 : 48;
  return `${(50 + radius * Math.sin(angle)).toFixed(2)}% ${(50 - radius * Math.cos(angle)).toFixed(2)}%`;
}).join(",")})`;
