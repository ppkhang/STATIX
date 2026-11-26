import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount, googleEnabled } from "@/auth";
import AuthForm from "@/components/AuthForm";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { login, loginWithGoogle } from "@/lib/auth-actions";
import { safeNext } from "@/lib/auth-rules";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  // NFR-022: account and token pages stay out of search results
  return { title: `${t("loginTitle")} — STATIX`, robots: { index: false, follow: false } };
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const next = safeNext(query.next, "/account");
  if (await currentAccount()) redirect(next);
  const t = await getTranslations("auth");

  return (
    <>
      <h1>{t("loginTitle")}</h1>
      {query.reset === "1" && <p role="status" className={styles.notice}>{t("passwordChanged")}</p>}
      {query.error && <p role="alert" className={styles.error}>{t("error.generic")}</p>}
      <AuthForm action={login} fields={["email", "password"]} hidden={{ next }} submit={t("loginSubmit")} />
      {googleEnabled && (
        <form action={loginWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={styles.secondary}>{t("google")}</button>
        </form>
      )}
      <nav className={styles.links}>
        <Link href="/register">{t("toRegister")}</Link>
        <Link href="/reset">{t("toReset")}</Link>
      </nav>
    </>
  );
}
