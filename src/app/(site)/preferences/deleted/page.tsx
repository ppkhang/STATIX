import Link from "next/link";
import { getTranslations } from "next-intl/server";
import styles from "@/components/waitlist.module.css";

export const metadata = { robots: { index: false, follow: false } };

export default async function Deleted() {
  const t = await getTranslations("preferences");
  return (
    <div className={styles.card}>
      <h1>{t("deletedTitle")}</h1>
      <div className={styles.body}>
        <p className={styles.line} role="status">{t("deletedBody")}</p>
        <nav className={styles.links}><Link href="/drop/001">{t("toDrop")}</Link></nav>
      </div>
    </div>
  );
}
