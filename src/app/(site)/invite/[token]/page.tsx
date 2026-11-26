import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import styles from "@/components/waitlist.module.css";
import { logout } from "@/lib/auth-actions";
import { formatDateTime } from "@/lib/format";
import { accept, sendNewInvite } from "@/lib/invite-actions";
import { inviteExpiry, inviteView } from "@/lib/invite-rules";
import { findInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";
// NFR-022, and the link lets someone in early: keep it out of search results and other sites' logs
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Page 7: the personal early-access link (FR-025). Opening it spends nothing; the button does. */
export default async function InviteLink({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { again } = await searchParams;
  const t = await getTranslations("invite");
  const found = await findInvite(token);

  const card = (title: string, body: React.ReactNode) => (
    <div className={styles.card}>
      <h1>{title}</h1>
      <div className={styles.body}>{body}</div>
    </div>
  );
  if (!found) return card(t("badTitle"), <><p className={styles.line}>{t("badBody")}</p><nav className={styles.links}><Link href="/drop/001">{t("toDrop")}</Link></nav></>);

  const { invite, entry, drop } = found;
  const me = await currentAccount();
  const now = new Date();
  const view = inviteView(invite, entry, me, now);
  const dropHref = `/drop/${String(drop.number).padStart(3, "0")}`;
  const here = `/invite/${encodeURIComponent(token)}`;
  const toDrop = <nav className={styles.links}><Link href={dropHref}>{t("toDrop")}</Link></nav>;

  if (view === "yours") return card(t("inTitle", { drop: drop.name }), <><p className={styles.lead}>{t("inBody")}</p>{toDrop}</>);
  if (view === "used") return card(t("usedTitle"), <><p className={styles.line}>{t("usedBody")}</p>{toDrop}</>);
  if (view === "left") return card(t("leftTitle"), <><p className={styles.line}>{t("leftBody")}</p>{toDrop}</>);
  if (view === "expired") {
    const open = inviteExpiry(drop.publicAt, now) !== null && entry.status === "invited";
    return card(t("expiredTitle"), (
      <>
        <p className={styles.line}>{t(open ? "expiredOpen" : "expiredOver")}</p>
        {open && (again === "sent" ? <p className={styles.notice} role="status">{t("sentAgain")}</p> : (
          <form action={sendNewInvite}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={styles.primary}>{t("sendNew")}</button>
            {again === "limited" && <p className={styles.error} role="alert">{t("limited")}</p>}
          </form>
        ))}
        {toDrop}
      </>
    ));
  }

  const title = t("title", { drop: drop.name });
  const personal = <p className={styles.line}>{t("until", { time: formatDateTime(invite.expiresAt.toISOString()) })}</p>;
  if (view === "signedOut") {
    return card(title, (
      <>
        <p className={styles.lead}>{t("signInFirst")}</p>
        {personal}
        <nav className={styles.links}>
          <Link href={`/login?next=${encodeURIComponent(here)}`}>{t("logIn")}</Link>
          <Link href={`/register?email=${encodeURIComponent(entry.emailNorm)}`}>{t("signUp")}</Link>
        </nav>
        <p className={styles.line}>{t("afterSignUp")}</p>
      </>
    ));
  }
  if (view === "wrongAccount") {
    return card(title, (
      <>
        <p className={styles.line}>{t("wrongAccount", { email: me!.email })}</p>
        <form action={logout}><button type="submit" className={styles.secondary}>{t("signOut")}</button></form>
      </>
    ));
  }
  if (view === "unverified") {
    return card(title, <><p className={styles.line}>{t("unverified")}</p><nav className={styles.links}><Link href="/account">{t("toAccount")}</Link></nav></>);
  }
  return card(title, (
    <>
      <p className={styles.lead}>{t("ready", { email: me!.email })}</p>
      {personal}
      <form action={accept}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={styles.primary}>{t("accept")}</button>
      </form>
    </>
  ));
}
