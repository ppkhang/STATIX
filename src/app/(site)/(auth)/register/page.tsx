import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AuthForm from "@/components/AuthForm";
import AuthStage from "@/components/AuthStage";
import styles from "@/components/auth.module.css";
import Link from "next/link";
import { register } from "@/lib/auth-actions";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

export default async function Register({ searchParams }: PageProps<"/register">) {
  if (await currentAccount()) redirect("/account");
  const { email } = await searchParams; // from the waitlist's "Create an account"
  const t = await getTranslations("auth");

  return (
    <AuthStage
      below={
        <nav className={styles.links}>
          <Link href="/verify">{t("toVerify")}</Link>
        </nav>
      }
    >
      <AuthForm action={register} fields={["email", "newPassword"]} submit={t("registerSubmit")} email={typeof email === "string" ? email.slice(0, 254) : undefined} />
    </AuthStage>
  );
}
