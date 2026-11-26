"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./shell.module.css";

const KEY = "statix-consent";

// NFR-019: analytics loads only after Accept; Decline is as easy as Accept.
// shortcut: no analytics exists yet, so the choice is only stored. Read `statix-consent` before loading any.
export default function ConsentBanner() {
  const t = useTranslations("consent");
  const [open, setOpen] = useState(false);

  // localStorage is only readable after mount, so the banner can't be decided during render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(!localStorage.getItem(KEY)), []);

  if (!open) return null;
  const choose = (value: "accepted" | "declined") => {
    localStorage.setItem(KEY, value);
    setOpen(false);
  };

  return (
    <section className={styles.consent} aria-label={t("label")}>
      <p>{t("text")}</p>
      <div className={styles.consentActions}>
        <button type="button" className={styles.btn} onClick={() => choose("accepted")}>{t("accept")}</button>
        <button type="button" className={styles.btn} onClick={() => choose("declined")}>{t("decline")}</button>
      </div>
    </section>
  );
}
