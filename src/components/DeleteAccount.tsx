"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteMyAccount, type DeleteAccountState } from "@/lib/account-actions";
import styles from "./waitlist.module.css";

export default function DeleteAccount({ needsPassword }: { needsPassword: boolean }) {
  const t = useTranslations("deleteAccount");
  const [state, run, pending] = useActionState<DeleteAccountState, FormData>(deleteMyAccount, {});
  return (
    <form action={run} className={styles.details} noValidate>
      {needsPassword && (
        <label className={styles.field}>
          <span>{t("password")}</span>
          <input name="password" type="password" autoComplete="current-password" aria-describedby="delete-status" />
        </label>
      )}
      <label className={styles.field}>
        <span>{t("typeLabel")}</span>
        <input name="confirm" autoComplete="off" spellCheck={false} aria-describedby="delete-status" />
      </label>
      <button type="submit" className={styles.secondary} disabled={pending}>{t("button")}</button>
      <p id="delete-status" className={styles.error} role="alert">{state.error ? t(`error.${state.error}`) : ""}</p>
    </form>
  );
}
