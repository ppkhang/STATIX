"use client";

import { useActionState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buy, type BuyState } from "@/lib/checkout-actions";
import WaitlistSignup from "./WaitlistSignup";
import styles from "./catalogue.module.css";

/** "Buy now" for one edition. The server decides everything; this only shows what it answered. */
export default function BuyButton({ editionId, label, minutes }: { editionId: string; label: string; minutes: number }) {
  const t = useTranslations("buy");
  const from = usePathname();
  const [state, run, pending] = useActionState<BuyState, FormData>(buy, {});
  return (
    <>
      <form action={run}>
        <input type="hidden" name="edition" value={editionId} />
        <input type="hidden" name="from" value={from} />
        <button type="submit" className={styles.cta} disabled={pending}>{pending ? t("holding") : label}</button>
      </form>
      {/* said once, with the way out of it where there is one */}
      <p role="alert" className={styles.refusal}>
        {state.error ? t(`error.${state.error}`, { minutes }) : ""}
        {(state.error === "needPhone" || state.error === "needEmail") && <> <Link href="/account">{t("toAccount")}</Link></>}
      </p>
      {state.error === "needInvite" && <WaitlistSignup label={t("joinInstead")} buttonClass={styles.cta} minutes={minutes} />}
    </>
  );
}
