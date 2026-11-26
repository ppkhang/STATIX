import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AutoConfirm, EntryDetails } from "@/components/ConfirmWaitlist";
import styles from "@/components/waitlist.module.css";
import WaitlistSignup from "@/components/WaitlistSignup";
import { sendNewLink } from "@/lib/waitlist-actions";
import { dropProducts, findLink } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
// NFR-022: token pages stay out of search results; and the link must not leak to other sites
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Page 1: reached from the double opt-in email (PRC-02). */
export default async function ConfirmWaitlist({ params, searchParams }: PageProps<"/waitlist/confirm/[token]">) {
  const { token } = await params;
  const { again } = await searchParams;
  const t = await getTranslations("waitlist");
  const found = await findLink(token);
  const live = found !== undefined && found.link.expiresAt > new Date();

  // the card: a straight header joined to its body, like the rest of the site
  const card = (title: string, body: React.ReactNode) => (
    <div className={styles.card}>
      <h1>{title}</h1>
      <div className={styles.body}>{body}</div>
    </div>
  );
  const signUpAgain = <WaitlistSignup label={t("signUpAgain")} buttonClass={styles.primary} minutes={0} />;

  if (!found) return card(t("badTitle"), <><p className={styles.line}>{t("badBody")}</p>{signUpAgain}</>);

  const { link, entry, drop } = found;
  if (link.usedAt && live && entry.status === "confirmed") {
    return card(t("onTitle", { drop }), (
      <>
        <p className={styles.lead}>{t("next")}</p>
        <EntryDetails token={token} products={await dropProducts(entry.dropId!)} interests={entry.interests} phone={entry.phone ?? ""} />
        <nav className={styles.links}>
          <Link href={`/register?email=${encodeURIComponent(entry.email)}`}>{t("createAccount")}</Link>
          <Link href="/drop/001">{t("toDrop")}</Link>
        </nav>
      </>
    ));
  }
  if (!link.usedAt && live && entry.status === "pending") return card(t("confirmingTitle"), <AutoConfirm token={token} />);

  // expired, or already used and out of date
  if (entry.status === "pending") {
    return card(t("expiredTitle"), (
      <>
        <p className={styles.line}>{t("expiredBody")}</p>
        {again === "sent" ? <p className={styles.notice} role="status">{t("sentAgain")}</p> : (
          <form action={sendNewLink}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={styles.primary}>{t("sendNew")}</button>
            {again === "limited" && <p className={styles.error} role="alert">{t("limited")}</p>}
          </form>
        )}
      </>
    ));
  }
  return card(t("usedTitle"), <><p className={styles.line}>{t("usedBody")}</p>{entry.status === "left" && signUpAgain}</>);
}
