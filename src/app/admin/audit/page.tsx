import { getTranslations } from "next-intl/server";
import styles from "@/components/admin.module.css";
import { formatDateTime } from "@/lib/format";
import { readAudit } from "@/lib/staff";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A day typed into the filter, as the start of that day in Vietnam. */
const day = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

/** A14: read only. There is deliberately no action on this page. */
export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await requireStaff("audit");
  const params = await searchParams;
  const field = (name: string) => String(params[name] ?? "").slice(0, 100);
  const [who, what, from, to] = ["who", "what", "from", "to"].map(field);
  const until = day(to);
  const rows = await readAudit({
    who, what, from: day(from),
    before: until && new Date(until.getTime() + 86_400_000), // "to" includes that whole day
  });
  const t = await getTranslations("admin");
  const show = (value: unknown) => (value === null ? "—" : JSON.stringify(value));

  return (
    <>
      <h1>{t("audit")}</h1>
      <form className={`${styles.panel} ${styles.filters}`}>
        <label><span>{t("who")}</span><input name="who" defaultValue={who} /></label>
        <label><span>{t("what")}</span><input name="what" defaultValue={what} /></label>
        <label><span>{t("from")}</span><input name="from" type="date" defaultValue={from} /></label>
        <label><span>{t("to")}</span><input name="to" type="date" defaultValue={to} /></label>
        <button type="submit">{t("filter")}</button>
      </form>
      {rows.length === 0 ? <p className={styles.note}>{t("noEntries")}</p> : (
        <div className={styles.scroll} tabIndex={0} role="region" aria-label={t("audit")}>
          <table className={styles.table}>
            <thead>
              <tr>{["when", "who", "what", "before", "after", "reason"].map((key) => <th key={key} scope="col">{t(key)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.nowrap}>{formatDateTime(row.at.toISOString())}</td>
                  <td>{row.who ?? t("commandLine")}</td>
                  <td>{row.entity} · {row.action}<br /><small>{row.entityId}</small></td>
                  <td><code>{show(row.oldValue)}</code></td>
                  <td><code>{show(row.newValue)}</code></td>
                  <td>{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
