"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { confirmEntry, saveDetails, type DetailsState } from "@/lib/waitlist-actions";
import styles from "./waitlist.module.css";

function Pending() {
  const t = useTranslations("waitlist");
  const { pending } = useFormStatus();
  return <p className={styles.line} role="status">{pending ? t("confirming") : ""}</p>;
}

/**
 * Confirms as soon as the page is open in a browser (US-021). It submits a real form from the page rather than
 * confirming on the request itself, because mail scanners open links.
 */
export function AutoConfirm({ token }: { token: string }) {
  const t = useTranslations("waitlist");
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    form.current?.requestSubmit();
  }, []);
  return (
    <form ref={form} action={confirmEntry}>
      <input type="hidden" name="token" value={token} />
      <Pending />
      <noscript><button type="submit" className={styles.primary}>{t("confirmButton")}</button></noscript>
    </form>
  );
}

type Details = { token: string; products: { slug: string; name: string }[]; interests: string[]; phone: string };

export function EntryDetails({ token, products, interests, phone }: Details) {
  const t = useTranslations("waitlist");
  const [state, run, pending] = useActionState<DetailsState, FormData>(saveDetails, {});
  return (
    <form action={run} className={styles.details} noValidate>
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend>{t("which")}</legend>
        <div className={styles.chips}>
          {products.map((product) => (
            <label key={product.slug}>
              <input type="checkbox" name="interest" value={product.slug} defaultChecked={interests.includes(product.slug)} />
              <span>{product.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={styles.field}>
        <span>{t("phone")}</span>
        <input type="tel" name="phone" autoComplete="tel" defaultValue={phone} aria-describedby="details-status" />
      </label>
      <button type="submit" className={styles.secondary} disabled={pending}>{t("save")}</button>
      <p id="details-status" className={state.error ? styles.error : styles.line} role="status">
        {state.error ? t(state.error) : state.saved ? t("saved") : ""}
      </p>
    </form>
  );
}
