"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteMyData, type DeleteState } from "@/lib/preferences-actions";
import styles from "./waitlist.module.css";

export default function DeleteData({ token }: { token: string }) {
  const t = useTranslations("preferences");
  const [state, run, pending] = useActionState<DeleteState, FormData>(deleteMyData, {});
  return (
    <form action={run} className={styles.details} noValidate>
      <input type="hidden" name="token" value={token} />
      <label className={styles.field}>
        <span>{t("typeLabel")}</span>
        <input name="confirm" autoComplete="off" spellCheck={false} aria-describedby="delete-status" />
      </label>
      <button type="submit" className={styles.secondary} disabled={pending}>{t("deleteButton")}</button>
      <p id="delete-status" className={styles.error} role="alert">{state.error ? t(state.error) : ""}</p>
    </form>
  );
}
