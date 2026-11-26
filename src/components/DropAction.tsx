import { useTranslations } from "next-intl";
import type { DropState } from "@/lib/drop-status";
import styles from "./catalogue.module.css";

type Props = { state: DropState; earlyAccessAt: string | null; publicAt: string | null };

/** The main button for each drop state. Buying arrives with M4, so nothing here can start a purchase. */
export default function DropAction({ state, earlyAccessAt, publicAt }: Props) {
  const t = useTranslations("drop");

  if (state === "public") {
    return <button type="button" className={styles.cta} disabled>{t("checkoutSoon")}</button>;
  }
  const headStart = earlyAccessAt && publicAt
    ? Math.round((Date.parse(publicAt) - Date.parse(earlyAccessAt)) / 60000) : 0;
  return (
    <>
      {state === "early_access" && <p>{t("membersFirst", { minutes: headStart })}</p>}
      {/* Plain <a>: the landing script only runs on a full page load. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className={styles.cta} href="/#signup-form">
        {state === "sold_out" || state === "closed" ? t("notifyNext") : t("joinWaitlist")}
      </a>
    </>
  );
}
