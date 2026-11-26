import Link from "next/link";
import { getTranslations } from "next-intl/server";
import DeleteData from "@/components/DeleteData";
import styles from "@/components/waitlist.module.css";
import { entryFromToken } from "@/lib/manage-token";
import { leaveList, setMarketing } from "@/lib/preferences-actions";
import { entriesFor, emailOf } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
// NFR-022, and the link is the key to the entry: it must not be indexed or leak to other sites
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** Page 17: waitlist status, leaving, marketing mail and deleting (FR-026, FR-099). */
export default async function Preferences({ params, searchParams }: PageProps<"/preferences/[token]">) {
  const { token } = await params;
  const { done } = await searchParams;
  const t = await getTranslations("preferences");
  const entryId = entryFromToken(token);
  const email = entryId ? await emailOf(entryId) : null;

  const card = (title: string, body: React.ReactNode) => (
    <div className={styles.card}>
      <h1>{title}</h1>
      <div className={styles.body}>{body}</div>
    </div>
  );
  if (!email) return card(t("goneTitle"), <><p className={styles.line}>{t("goneBody")}</p><nav className={styles.links}><Link href="/drop/001">{t("toDrop")}</Link></nav></>);

  const entries = await entriesFor(email);
  const marketing = entries.some((e) => e.status !== "left" && e.marketing);

  return card(t("title"), (
    <>
      {(done === "left" || done === "saved") && <p className={styles.notice} role="status">{t(done)}</p>}
      <p className={styles.line}>{email}</p>

      <section className={styles.section}>
        <h2>{t("statusTitle")}</h2>
        <ul className={styles.entries}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span><strong>{entry.drop}</strong> {t(`status.${entry.status}`)}</span>
              {entry.status !== "left" && (
                // two presses: the first only opens the confirmation
                <details>
                  <summary className={styles.secondary}>{t("leave")}</summary>
                  <form action={leaveList}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="entry" value={entry.id} />
                    <p className={styles.line}>{t("leaveAsk", { drop: entry.drop })}</p>
                    <button type="submit" className={styles.primary}>{t("leaveConfirm")}</button>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>{t("marketingTitle")}</h2>
        <p className={styles.line}>{t("marketingNote")}</p>
        {entries.every((e) => e.status === "left") ? <p className={styles.line}>{t("marketingLeft")}</p> : (
          <form action={setMarketing}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="marketing" value={marketing ? "off" : "on"} />
            <button type="submit" className={styles.toggle} role="switch" aria-checked={marketing}>
              <i aria-hidden="true" /><span>{t(marketing ? "marketingOn" : "marketingOff")}</span>
            </button>
          </form>
        )}
      </section>

      <section className={styles.section}>
        <h2>{t("deleteTitle")}</h2>
        <p className={styles.line}>{t("deleteWhat")}</p>
        <DeleteData token={token} />
      </section>
    </>
  ));
}
