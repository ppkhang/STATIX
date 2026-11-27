"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAddress, type AddressState } from "@/lib/checkout-actions";
import type { Address } from "@/lib/checkout-rules";
import waitlist from "./waitlist.module.css";
import styles from "./checkout.module.css";

const FIELDS = [
  ["recipient", "name"], ["receiverPhone", "tel"], ["province", "address-level1"], ["ward", "address-level3"], ["street", "street-address"],
] as const;

/** `id` is for the address book: the address being edited, or "new". Checkout leaves it out. */
export default function AddressForm({ saved, id }: { saved: Address | null; id?: string }) {
  const t = useTranslations("checkout");
  const [state, run, pending] = useActionState<AddressState, FormData>(saveAddress, {});
  return (
    <form action={run} className={styles.address} noValidate>
      {id && <><input type="hidden" name="from" value="book" /><input type="hidden" name="id" value={id} /></>}
      {FIELDS.map(([name, autoComplete]) => (
        <label key={name} className={name === "street" ? styles.wide : undefined}>
          <span>{t(`field.${name}`)}</span>
          <input
            name={name} autoComplete={autoComplete} type={name === "receiverPhone" ? "tel" : "text"} required maxLength={120}
            defaultValue={state.values?.[name] ?? saved?.[name] ?? ""} aria-describedby="address-error"
          />
        </label>
      ))}
      <button type="submit" className={`${waitlist.secondary} ${styles.wide}`} disabled={pending}>{t("saveAddress")}</button>
      <p id="address-error" role="alert" className={`${styles.error} ${styles.wide}`}>{state.error ? t(`addressError.${state.error}`) : ""}</p>
    </form>
  );
}
