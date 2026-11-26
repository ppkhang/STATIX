import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AuthForm from "@/components/AuthForm";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { peekToken } from "@/lib/accounts";
import { resendVerify, verifyEmail } from "@/lib/auth-actions";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

export default async function Verify({ searchParams }: PageProps<"/verify">) {
  const { token, done } = await searchParams;
  const t = await getTranslations("auth");
  const me = await currentAccount();
  // Opening the link changes nothing; the button does.
  const target = typeof token === "string" ? await peekToken(token, "verify") : undefined;

  let body;
  if (done === "1") {
    body = (
      <>
        <p role="status" className={styles.notice}>{t("verified")}</p>
        <nav className={styles.links}><Link href={me ? "/account" : "/login"}>{me ? t("toAccount") : t("toLogin")}</Link></nav>
      </>
    );
  } else if (target) {
    const signedIn = me?.id === target.id;
    body = (
      <>
        <p>{signedIn ? t("confirmSignedIn") : t("confirmWithPassword")}</p>
        <AuthForm action={verifyEmail} fields={signedIn ? [] : ["password"]} hidden={{ token: token as string }} submit={t("verifySubmit")} />
        {!signedIn && <nav className={styles.links}><Link href="/reset">{t("toReset")}</Link></nav>}
      </>
    );
  } else {
    body = (
      <>
        {token !== undefined && <p role="alert" className={styles.error}>{t("error.badLink")}</p>}
        <AuthForm action={resendVerify} fields={["email"]} submit={t("resend")} />
      </>
    );
  }

  return (
    <>
      <h1>{t("verifyTitle")}</h1>
      {body}
    </>
  );
}
