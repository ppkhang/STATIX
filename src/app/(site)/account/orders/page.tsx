import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import styles from "@/components/checkout.module.css";
import card from "@/components/waitlist.module.css";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import { listOrders } from "@/lib/orders";
import { expireStaleOrders } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Page 14, the list. Orders are made by Pay, which so far only has the mock provider. */
export default async function Orders() {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/orders");
  const t = await getTranslations("orders");
  const account = await getTranslations("account");
  await expireStaleOrders(me.id);
  const orders = await listOrders(me.id);

  return (
    <div className={card.card}>
      <h1>{t("title")}</h1>
      <div className={card.body}>
        {orders.length === 0 && <p className={card.line}>{t("empty")}</p>}
        {orders.map((order) => (
          <article key={order.id} className={styles.held}>
            <p className={styles.item}>
              <strong><Link href={`/account/orders/${encodeURIComponent(order.orderNo)}`}>{t("order", { number: order.orderNo })}</Link></strong>
              <span>{t(`status.${order.status}`)}</span>
              <b>{formatVnd(order.totalVnd)}</b>
            </p>
            <p className={card.line}>
              {t("placed", { time: formatDateTime(order.createdAt.toISOString()) })}<br />
              {order.lines.map((line) => `${line.name} No. ${unitNumber(line.number)}`).join(", ")}
            </p>
          </article>
        ))}
        <nav className={card.links}><Link href="/account">{account("back")}</Link><Link href="/drop/001">{account("toDrop")}</Link></nav>
      </div>
    </div>
  );
}
