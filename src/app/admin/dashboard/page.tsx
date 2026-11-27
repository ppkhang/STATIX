import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AdminMeter from "@/components/AdminMeter";
import AutoRefresh from "@/components/AutoRefresh";
import styles from "@/components/admin.module.css";
import { dashboard } from "@/lib/admin-dashboard";
import { listDrops } from "@/lib/admin-drops";
import { getDrop, parseDropNumber } from "@/lib/catalogue";
import { formatCount, formatVnd } from "@/lib/format";
import { can } from "@/lib/staff";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** A2. The current drop unless another is picked. */
export default async function Dashboard({ searchParams }: PageProps<"/admin/dashboard">) {
  const me = await requireStaff("dashboard");
  const asked = parseDropNumber(String((await searchParams).drop ?? ""));
  const number = asked ?? (await getDrop())?.number;
  const data = number === undefined ? null : await dashboard(me, number);
  const drops = await listDrops();
  const t = await getTranslations("admin");
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  const sum = (key: "size" | "left" | "held" | "sold" | "retired") => data?.editions.reduce((total, row) => total + row[key], 0) ?? 0;
  const [size, held, sold, retired] = [sum("size"), sum("held"), sum("sold"), sum("retired")];
  const parts = [["sold", sold], ["held", held], ["retired", retired], ["left", sum("left")]] as const;

  return (
    <>
      <AutoRefresh seconds={5} />
      <div className={styles.top}>
        <h1>{t("dashboard")}</h1>
        {data && <p className={styles.quiet}>{t("updated", { time: now })}</p>}
      </div>
      <nav className={styles.picker} aria-label={t("drops")}>
        {drops.map((drop) => (
          <Link key={drop.id} href={`/admin/dashboard?drop=${drop.number}`} aria-current={drop.number === number ? "page" : undefined}>{drop.name}</Link>
        ))}
      </nav>
      {!data ? <p className={styles.note}>{t("noEntries")}</p> : (
        <>
          <dl className={`${styles.tiles} ${styles.kpis}`}>
            <div className={`${styles.panel} ${styles.tile} ${styles.lead}`}>
              <dt>{t("revenue")}</dt><dd className={styles.figure}>{formatVnd(data.paid.totalVnd)}</dd><dd className={styles.note2}>{t("revenueNote")}</dd>
            </div>
            <div className={`${styles.panel} ${styles.tile}`}>
              <dt>{t("paidOrders")}</dt><dd className={`${styles.figure} ${styles.count}`}>{formatCount(data.paid.orders)}</dd>
            </div>
            <div className={`${styles.panel} ${styles.tile}`}>
              <dt>{t("openHolds")}</dt><dd className={`${styles.figure} ${styles.count}`}>{formatCount(data.holds.open)}</dd>
            </div>
            <div className={`${styles.panel} ${styles.tile}`}>
              <dt>{t("waitlist")}</dt><dd className={`${styles.figure} ${styles.count}`}>{formatCount(data.waitlist.confirmed)}</dd>
              <dd className={styles.note2}>{t("unconfirmed", { count: data.waitlist.pending })}</dd>
            </div>
          </dl>

          <div className={styles.split}>
            <section className={styles.panel}>
              <h2>{t("sellThrough")}</h2>
              <p className={styles.headline}><strong>{share(sold + held, size)}%</strong><span>{t("ofUnits", { taken: formatCount(sold + held), total: formatCount(size) })}</span></p>
              <AdminMeter size={size} sold={sold} held={held} retired={retired} />
              <ul className={styles.legend}>
                {parts.map(([part, units]) => <li key={part} data-part={part}>{t(part)} <b>{formatCount(units)}</b></li>)}
              </ul>
            </section>

            <section className={styles.panel}>
              <h2>{t("funnel")}</h2>
              <p className={styles.headline}><strong>{share(data.paid.people, data.holds.people)}%</strong><span>{t("funnelRate")}</span></p>
              <div className={styles.funnel}>
                <span>{t("held")}</span><AdminMeter size={data.holds.people} sold={0} retired={data.holds.people} /><b>{formatCount(data.holds.people)}</b>
                <span>{t("paidShort")}</span><AdminMeter size={data.holds.people} sold={data.paid.people} /><b>{formatCount(data.paid.people)}</b>
              </div>
              <p className={`${styles.quiet} ${styles.after}`}>{t("funnelNote")}</p>
            </section>

            <section className={`${styles.panel} ${styles.tile} ${styles.minor}`}>
              <h2>{t("owed")}</h2>
              <p className={`${styles.figure} ${data.owedVnd ? styles.alert : ""}`}>{formatVnd(data.owedVnd)}</p>
              {data.owedVnd > 0 && can(me.role, "orders")
                ? <Link className={styles.link} href={`/admin/orders?owed=on&drop=${data.drop.number}`}>{t("seeOwed")}</Link>
                : <p className={styles.quiet}>{data.owedVnd ? t("notSent") : t("nothingOwed")}</p>}
            </section>
          </div>

          <h2>{t("editions")}</h2>
          <div className={styles.scroll} tabIndex={0} role="region" aria-label={t("editions")}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("variant")}</th>
                  <th scope="col">{t("progress")}</th>
                  {["left", "held", "sold", "retired", "size"].map((key) => <th key={key} scope="col" className={styles.num}>{t(key)}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.editions.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className={styles.nowrap}>{row.name} · {row.colour}</th>
                    <td className={styles.wide}><AdminMeter size={row.size} sold={row.sold} held={row.held} retired={row.retired} /></td>
                    <td className={`${styles.num} ${styles.big}`}>{formatCount(row.left)}</td>
                    <td className={styles.num}>{formatCount(row.held)}</td>
                    <td className={styles.num}>{formatCount(row.sold)}</td>
                    <td className={styles.num}>{formatCount(row.retired)}</td>
                    <td className={styles.num}>{formatCount(row.size)}</td>
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
