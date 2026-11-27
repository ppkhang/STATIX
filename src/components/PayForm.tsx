"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { pay, type PayState } from "@/lib/payment-actions";
import { ONLINE_METHODS } from "@/lib/payment-rules";
import waitlist from "./waitlist.module.css";
import styles from "./checkout.module.css";

const NAMES = { vnpay: "VNPay", momo: "MoMo" } as const;

export default function PayForm({ attempt, ready }: { attempt: string; ready: boolean }) {
  const t = useTranslations("checkout");
  const [state, run, pending] = useActionState<PayState, FormData>(pay, {});
  const [method, setMethod] = useState<string>(ONLINE_METHODS[0]);
  const [agreed, setAgreed] = useState(false);
  return (
    // kept in state, because the form is reset after an error and the choices shouldn't be lost
    <form action={run} className={styles.pay}>
      <input type="hidden" name="attempt" value={attempt} />
      <p className={waitlist.notice}>{t("testMode")}</p>
      <fieldset>
        <legend>{t("method")}</legend>
        {ONLINE_METHODS.map((name) => (
          <label key={name}>
            <input type="radio" name="method" value={name} checked={method === name} onChange={() => setMethod(name)} />
            {t("testName", { name: NAMES[name] })}
          </label>
        ))}
      </fieldset>
      <label>
        <input type="checkbox" name="agree" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        <span>
          {t.rich("agree", {
            // a new tab, so reading them doesn't take you away from a running hold
            terms: (text) => <Link href="/terms" target="_blank">{text}</Link>,
            returns: (text) => <Link href="/returns" target="_blank">{text}</Link>,
          })}
        </span>
      </label>
      <button type="submit" className={waitlist.primary} disabled={pending || !agreed || !ready}>{pending ? t("paying") : t("pay")}</button>
      <p role="alert" className={styles.error}>{state.error ? t(`payError.${state.error}`) : !ready ? t("payError.noAddress") : ""}</p>
    </form>
  );
}
