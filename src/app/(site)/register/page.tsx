import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount, googleEnabled } from "@/auth";
import AuthForm from "@/components/AuthForm";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { loginWithGoogle, register } from "@/lib/auth-actions";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  // NFR-022: account and token pages stay out of search results
  return { title: `${t("registerTitle")} — STATIX`, robots: { index: false, follow: false } };
}

export default async function Register() {
  if (await currentAccount()) redirect("/account");
  const t = await getTranslations("auth");

  return (
    <>
      <h1>{t("registerTitle")}</h1>
      <AuthForm action={register} fields={["email", "newPassword"]} submit={t("registerSubmit")} />
      {googleEnabled && (
        <form action={loginWithGoogle}>
          <button type="submit" className={styles.secondary}>{t("google")}</button>
        </form>
      )}
      <nav className={styles.links}>
        <Link href="/login">{t("toLogin")}</Link>
        <Link href="/verify">{t("toVerify")}</Link>
      </nav>
    </>
  );
}
