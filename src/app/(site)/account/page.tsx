import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AuthForm from "@/components/AuthForm";
import NextDrop from "@/components/NextDrop";
import styles from "@/components/auth.module.css";
import { db } from "@/db";
import { dropRun, tier } from "@/db/schema";
import { pendingOtp } from "@/lib/accounts";
import { getDrop } from "@/lib/catalogue";
import { invitedTo } from "@/lib/invites";
import { checkPhoneCode, resendVerify, sendPhoneCode } from "@/lib/auth-actions";
import { manageToken } from "@/lib/manage-token";
import { anyEntryId } from "@/lib/waitlist";

// NFR-022: account and token pages stay out of search results
export const metadata = { robots: { index: false, follow: false } };

// Page 13, plus the email and phone checks. Collection (R2) and trade-in (R3) get tiles when they exist.
export default async function AccountPage() {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account");
  const t = await getTranslations("auth");
  const [level] = await db.select().from(tier).where(eq(tier.id, me.tierId));
  const pending = me.emailVerified ? await pendingOtp(me.id) : undefined;
  // only once the address is proven: until then this could be someone else's waitlist entry
  const listed = me.emailVerified ? await anyEntryId(me.email) : null;

  const a = await getTranslations("account");
  const drop = await getDrop();
  const [run] = drop ? await db.select({ id: dropRun.id }).from(dropRun).where(eq(dropRun.number, drop.number)) : [];
  // the same rule a hold goes by (purchase-rules.ts); only worth saying while early access is ahead or on
  const early = drop && run && (drop.state === "scheduled" || drop.state === "early_access")
    ? level.code === "founder" || (await invitedTo(me.id, run.id)) : null;

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
      <details className={styles.benefits}>
        <summary>{a("benefits")}</summary>
        <p>{a(`benefit.${level.code as "visitor" | "waitlist" | "member" | "founder"}`)}</p>
      </details>

      <nav className={styles.links} aria-label={a("tiles")}>
        <Link href="/account/orders">{a("orders")}</Link>
        <Link href="/account/addresses">{a("addresses")}</Link>
        {listed && <Link href={`/preferences/${manageToken(listed)}`}>{t("waitlistPrivacy")}</Link>}
      </nav>

      {drop && drop.state !== "closed" && (
        <>
          <h2>{a("nextDrop")}: {drop.name}</h2>
          <NextDrop key={drop.number} initial={drop} />
          {early !== null && <p>{a(early ? "earlyYes" : "earlyNo", { drop: drop.name })}</p>}
          <nav className={styles.links}><Link href={`/drop/${String(drop.number).padStart(3, "0")}`}>{a("toDrop")}</Link></nav>
        </>
      )}

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

      <nav className={styles.links}><Link href="/account/delete">{a("delete")}</Link></nav>
    </>
  );
}
