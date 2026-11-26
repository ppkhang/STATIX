import { useTranslations } from "next-intl";
import type { DropState } from "@/lib/drop-status";
import BuyButton from "./BuyButton";
import WaitlistSignup from "./WaitlistSignup";
import styles from "./catalogue.module.css";

type Props = { state: DropState; earlyAccessAt: string | null; publicAt: string | null; editionId?: string };

/** The main button for each drop state. "Buy now" holds a unit; whether this person may is decided on the server. */
export default function DropAction({ state, earlyAccessAt, publicAt, editionId }: Props) {
  const t = useTranslations("drop");

  const headStart = earlyAccessAt && publicAt
    ? Math.round((Date.parse(publicAt) - Date.parse(earlyAccessAt)) / 60000) : 0;
  if (state === "public" || state === "early_access") {
    // the Drop page has a button on each row instead of one at the top
    return (
      <>
        {state === "early_access" && <p>{t("membersFirst", { minutes: headStart })}</p>}
        {editionId && <BuyButton key={editionId} editionId={editionId} label={t("buyNow")} minutes={headStart} />}
      </>
    );
  }
  return (
    <>
      <WaitlistSignup
        buttonClass={styles.cta} minutes={state === "sold_out" || state === "closed" ? 0 : headStart}
        label={state === "sold_out" || state === "closed" ? t("notifyNext") : t("joinWaitlist")}
      />
    </>
  );
}
