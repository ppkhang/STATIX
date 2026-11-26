import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount, googleEnabled } from "@/auth";
import AuthForm from "@/components/AuthForm";
import AuthStage from "@/components/AuthStage";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { loginWithGoogle, register } from "@/lib/auth-actions";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

export default async function Register() {
  if (await currentAccount()) redirect("/account");
  const t = await getTranslations("auth");

  return (
    <AuthStage
      title={t("registerTitle")}
      below={
        <>
          {googleEnabled && (
            <form action={loginWithGoogle}>
              <button type="submit" className="btn btn--secondary"><span>{t("google")}</span></button>
            </form>
          )}
          <nav className={styles.links}>
            <Link href="/login">{t("toLogin")}</Link>
            <Link href="/verify">{t("toVerify")}</Link>
          </nav>
        </>
      }
    >
      <AuthForm action={register} fields={["email", "newPassword"]} submit={t("registerSubmit")} />
    </AuthStage>
  );
}
