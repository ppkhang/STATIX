import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AutoRefresh from "@/components/AutoRefresh";
import styles from "@/components/admin.module.css";
import { dashboard } from "@/lib/admin-dashboard";
import { listDrops } from "@/lib/admin-drops";
import { getDrop, parseDropNumber } from "@/lib/catalogue";
import { formatVnd } from "@/lib/format";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A2. The current drop unless another is picked. */
export default async function Dashboard({ searchParams }: PageProps<"/admin/dashboard">) {
  const me = await requireStaff("dashboard");
  const asked = parseDropNumber(String((await searchParams).drop ?? ""));
  const number = asked ?? (await getDrop())?.number;
  const data = number === undefined ? null : await dashboard(me, number);
  const drops = await listDrops();
  const t = await getTranslations("admin");
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <>
      <AutoRefresh seconds={5} />
      <h1>{t("dashboard")}</h1>
      <nav className={styles.picker} aria-label={t("drops")}>
        {drops.map((drop) => (
          <Link key={drop.id} href={`/admin/dashboard?drop=${drop.number}`} aria-current={drop.number === number ? "page" : undefined}>{drop.name}</Link>
        ))}
      </nav>
      {!data ? <p>{t("noEntries")}</p> : (
        <>
          <p>{t("updated", { time: now })}</p>
          <dl className={styles.tiles}>
            <div><dt>{t("waitlist")}</dt><dd>{data.waitlist.confirmed}<small>{t("unconfirmed", { count: data.waitlist.pending })}</small></dd></div>
            <div><dt>{t("openHolds")}</dt><dd>{data.holds.open}</dd></div>
            <div><dt>{t("paidOrders")}</dt><dd>{data.paid.orders}</dd></div>
            <div><dt>{t("revenue")}</dt><dd>{formatVnd(data.paid.totalVnd)}<small>{t("revenueNote")}</small></dd></div>
            <div><dt>{t("owed")}</dt><dd>{formatVnd(data.owedVnd)}</dd></div>
            <div><dt>{t("funnel")}</dt><dd>{t("funnelValue", { held: data.holds.people, paid: data.paid.people })}<small>{t("funnelNote")}</small></dd></div>
          </dl>

          <h2>{t("editions")}</h2>
          <div className={styles.scroll} tabIndex={0} role="region" aria-label={t("editions")}>
            <table className={styles.table}>
              <thead>
                <tr>{["variant", "size", "left", "held", "sold", "retired"].map((key) => <th key={key} scope="col">{t(key)}</th>)}</tr>
              </thead>
              <tbody>
                {data.editions.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.name} · {row.colour}</th>
                    <td>{row.size}</td><td>{row.left}</td><td>{row.held}</td><td>{row.sold}</td><td>{row.retired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
