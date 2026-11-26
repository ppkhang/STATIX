import { getTranslations } from "next-intl/server";
import AuthForm from "@/components/AuthForm";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { peekToken } from "@/lib/accounts";
import { forgotPassword, resetPassword } from "@/lib/auth-actions";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

export default async function Reset({ searchParams }: PageProps<"/reset">) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  const valid = typeof token === "string" && Boolean(await peekToken(token, "reset"));

  return (
    <>
      <h1>{t("resetTitle")}</h1>
      {valid ? (
        <AuthForm action={resetPassword} fields={["newPassword"]} hidden={{ token: token as string }} submit={t("resetSubmit")} />
      ) : (
        <>
          {token !== undefined && <p role="alert" className={styles.error}>{t("error.badLink")}</p>}
          <AuthForm action={forgotPassword} fields={["email"]} submit={t("sendLink")} />
        </>
      )}
      <nav className={styles.links}><Link href="/login">{t("toLogin")}</Link></nav>
    </>
  );
}
