"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { staffLogin, type StaffLoginState } from "@/lib/staff-actions";
import styles from "./admin.module.css";

export default function StaffLogin() {
  const t = useTranslations("admin");
  const [state, run, pending] = useActionState<StaffLoginState, FormData>(staffLogin, {});
  return (
    <form action={run} className={`${styles.filters} ${styles.loginForm}`} noValidate>
      <label><span>{t("email")}</span><input name="email" type="email" autoComplete="username" required defaultValue={state.email} aria-describedby="staff-login-error" /></label>
      <label><span>{t("password")}</span><input name="password" type="password" autoComplete="current-password" required aria-describedby="staff-login-error" /></label>
      <label><span>{t("code")}</span><input className={styles.code} name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required aria-describedby="staff-login-error" /></label>
      <p id="staff-login-error" role="alert" className={styles.error}>{state.error ? t(`error.${state.error}`) : ""}</p>
      <button type="submit" disabled={pending}>{t("logIn")}</button>
    </form>
  );
}
