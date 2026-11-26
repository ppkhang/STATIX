import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AuthForm from "@/components/AuthForm";
import styles from "@/components/auth.module.css";
import { db } from "@/db";
import { tier } from "@/db/schema";
import { pendingOtp } from "@/lib/accounts";
import { checkPhoneCode, resendVerify, sendPhoneCode } from "@/lib/auth-actions";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

// Sign-in basics only: orders, addresses and the rest of page 13 arrive with M5.
export default async function AccountPage() {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account");
  const t = await getTranslations("auth");
  const [level] = await db.select().from(tier).where(eq(tier.id, me.tierId));
  const pending = me.emailVerified ? await pendingOtp(me.id) : undefined;

  return (
    <>
      <h1>{t("accountTitle")}</h1>
      <dl className={styles.facts}>
        <dt>{t("field.email")}</dt>
        <dd>{me.email} · {me.emailVerified ? t("isVerified") : t("notVerified")}</dd>
        <dt>{t("tier")}</dt>
        <dd>{t(`tiers.${level.code}`)}</dd>
        <dt>{t("field.phone")}</dt>
        <dd>{me.phoneVerified ? `${me.phone} · ${t("isVerified")}` : t("noPhone")}</dd>
      </dl>

      {!me.emailVerified ? (
        <>
          <p>{t("verifyBeforeBuying")}</p>
          {/* the address comes from the session, not from a typed field */}
          <AuthForm action={resendVerify} fields={[]} hidden={{ email: me.email }} submit={t("resend")} />
        </>
      ) : (
        <>
          <h2>{t("phoneTitle")}</h2>
          <AuthForm key="phone" action={sendPhoneCode} fields={["phone"]} submit={t("sendCode")} />
          {pending && (
            <>
              <p role="status">{t("codeSent", { phone: pending.phone })}</p>
              <AuthForm key="code" action={checkPhoneCode} fields={["code"]} submit={t("checkCode")} />
            </>
          )}
        </>
      )}
    </>
  );
}
