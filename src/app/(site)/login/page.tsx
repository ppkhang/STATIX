import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount, googleEnabled } from "@/auth";
import AuthForm from "@/components/AuthForm";
import AuthStage from "@/components/AuthStage";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { login, loginWithGoogle } from "@/lib/auth-actions";
import { safeNext } from "@/lib/auth-rules";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const next = safeNext(query.next, "/account");
  if (await currentAccount()) redirect(next);
  const t = await getTranslations("auth");

  return (
    <AuthStage
      title={t("loginTitle")}
      below={
        <>
          {googleEnabled && (
            <form action={loginWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="btn btn--secondary"><span>{t("google")}</span></button>
            </form>
          )}
          <nav className={styles.links}>
            <Link href="/register">{t("toRegister")}</Link>
          </nav>
        </>
      }
    >
      {query.reset === "1" && <p role="status" className={styles.notice}>{t("passwordChanged")}</p>}
      {query.error && <p role="alert" className={styles.error}>{t("error.generic")}</p>}
      <AuthForm
        action={login} fields={["email", "password"]} hidden={{ next }} submit={t("loginSubmit")}
        passwordHelp={<Link href="/reset">{t("toReset")}</Link>}
      />
    </AuthStage>
  );
}
