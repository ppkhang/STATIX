import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import styles from "@/components/admin.module.css";
import { customerOrder } from "@/db/schema";
import { searchOrders, type OrderStatusFilter } from "@/lib/admin-orders";
import { parseDropNumber } from "@/lib/catalogue";
import { formatDateTime, formatVnd } from "@/lib/format";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A8, the list. Read only. */
export default async function Orders({ searchParams }: PageProps<"/admin/orders">) {
  const me = await requireStaff("orders");
  const params = await searchParams;
  const field = (name: string) => String(params[name] ?? "").trim().slice(0, 100);
  const [q, status, drop] = ["q", "status", "drop"].map(field);
  const owed = field("owed") === "on";
  const statuses = customerOrder.status.enumValues;
  const rows = await searchOrders(me, {
    q: q || undefined, status: statuses.find((value) => value === status) as OrderStatusFilter | undefined,
    drop: parseDropNumber(drop) ?? undefined, owed,
  });
  if (!rows) notFound();
  const t = await getTranslations("admin");
  const o = await getTranslations("orders");

  return (
    <>
      <h1>{t("orders")}</h1>
      <form className={`${styles.panel} ${styles.filters}`}>
        <label><span>{t("search")}</span><input name="q" defaultValue={q} /></label>
        <label>
          <span>{t("status")}</span>
          <select name="status" defaultValue={status}>
            <option value="">{t("any")}</option>
            {statuses.map((value) => <option key={value} value={value}>{o(`status.${value}`)}</option>)}
          </select>
        </label>
        <label><span>{t("dropNumber")}</span><input name="drop" inputMode="numeric" defaultValue={drop} /></label>
        <label className={styles.check}><input type="checkbox" name="owed" defaultChecked={owed} /><span>{t("owedOnly")}</span></label>
        <button type="submit">{t("filter")}</button>
      </form>
      {rows.length === 0 ? <p className={styles.note}>{t("noEntries")}</p> : (
        <div className={styles.scroll} tabIndex={0} role="region" aria-label={t("orders")}>
          <table className={styles.table}>
            <thead>
              <tr>{["orderNo", "when", "customer", "status", "total", "owed"].map((key) => <th key={key} scope="col" className={key === "total" || key === "owed" ? styles.num : undefined}>{t(key)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.nowrap}><Link href={`/admin/orders/${row.orderNo}`}>{row.orderNo}</Link></td>
                  <td className={styles.nowrap}>{formatDateTime(row.createdAt.toISOString())}</td>
                  <td>{row.email}</td>
                  <td><span className={styles.chip} data-status={row.status}>{o(`status.${row.status}`)}</span></td>
                  <td className={styles.num}>{formatVnd(row.totalVnd)}</td>
                  <td className={styles.num}>{row.owedVnd ? <strong className={styles.alert}>{formatVnd(row.owedVnd)}</strong> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
