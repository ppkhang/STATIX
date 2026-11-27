import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AdminForm from "@/components/AdminForm";
import styles from "@/components/admin.module.css";
import { createDropAction } from "@/lib/admin-actions";
import { listDrops } from "@/lib/admin-drops";
import { getDrop } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A3: the list, with each drop's state as the shop sees it, and "New drop". */
export default async function Drops() {
  await requireStaff("drops");
  const t = await getTranslations("admin");
  const d = await getTranslations("drop");
  // shortcut: one count per drop; fold into one query when there are more than a handful
  const drops = await Promise.all((await listDrops()).map(async (drop) => ({ ...drop, live: await getDrop(drop.number) })));
  const time = (date: Date | null) => (date ? formatDateTime(date.toISOString()) : "—");

  return (
    <>
      <h1>{t("drops")}</h1>
      <p className={styles.quiet}>{t("vietnamTime")}</p>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={t("drops")}>
        <table className={styles.table}>
          <thead>
            <tr>{["number", "name", "state", "earlyAccessAt", "publicAt", "closeAt"].map((key) => <th key={key} scope="col">{t(key)}</th>)}</tr>
          </thead>
          <tbody>
            {drops.map((drop) => (
              <tr key={drop.id}>
                <td><Link href={`/admin/drops/${drop.number}`}>{String(drop.number).padStart(3, "0")}</Link></td>
                <td>{drop.name}</td>
                <td><span className={styles.chip} data-status={drop.live?.state ?? "draft"}>{drop.live ? d(`state.${drop.live.state}`) : t("draft")}</span></td>
                <td>{time(drop.earlyAccessAt)}</td>
                <td>{time(drop.publicAt)}</td>
                <td>{time(drop.closeAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("newDrop")}</h2>
      <div className={styles.panel}><AdminForm
        action={createDropAction} hidden={{}} submit={t("create")} label={t("newDrop")}
        fields={[
          { name: "number", label: t("number"), type: "number" }, { name: "name", label: t("name") },
          { name: "earlyAccessAt", label: t("earlyAccessAt"), type: "datetime-local" },
          { name: "publicAt", label: t("publicAt"), type: "datetime-local" },
          { name: "closeAt", label: t("closeAt"), type: "datetime-local" },
        ]}
      /></div>
    </>
  );
}
