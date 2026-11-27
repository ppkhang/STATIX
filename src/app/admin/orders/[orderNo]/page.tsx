import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import styles from "@/components/admin.module.css";
import { staffOrder } from "@/lib/admin-orders";
import type { Address } from "@/lib/checkout-rules";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import { timeline } from "@/lib/order-rules";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A8, one order. Read only: serials, QC, shipments and staff refunds aren't built. */
export default async function StaffOrder({ params }: PageProps<"/admin/orders/[orderNo]">) {
  const me = await requireStaff("orders");
  const order = await staffOrder(me, (await params).orderNo);
  if (!order) notFound();
  const t = await getTranslations("admin");
  const o = await getTranslations("orders");
  const shipTo = order.shipTo as Address;
  const at = (date: Date) => formatDateTime(date.toISOString());
  const steps = timeline(order.status, order.paymentMethod);

  return (
    <>
      <nav><Link href="/admin/orders" className={styles.back}>← {t("allOrders")}</Link></nav>
      <h1>{order.orderNo} <span className={styles.chip} data-status={order.status}>{o(`status.${order.status}`)}</span></h1>
      {steps && (
        <ol className={`${styles.panel} ${styles.steps}`} aria-label={o("progress")}>
          {steps.map((step) => (
            <li key={step.status} data-state={step.state} aria-current={step.state === "now" ? "step" : undefined}>
              {o(`status.${step.status}`)}
              {step.state !== "later" && <span className={styles.srOnly}> ({o(step.state === "now" ? "current" : "complete")})</span>}
            </li>
          ))}
        </ol>
      )}

      <div className={styles.split}>
        <section className={`${styles.panel} ${styles.tile} ${styles.lead}`}>
          <h2>{o("total")}</h2>
          <p className={styles.figure}>{formatVnd(order.totalVnd)}</p>
          <p className={styles.quiet}>{o("shipping")}: {formatVnd(order.shippingVnd)} · {o(`methods.${order.paymentMethod}`)}</p>
        </section>
        <section className={styles.panel}>
          <h2>{t("customer")}</h2>
          <dl className={styles.facts}>
            <dt>{t("email")}</dt><dd>{order.email}</dd>
            <dt>{t("when")}</dt><dd>{at(order.createdAt)}</dd>
          </dl>
        </section>
        <section className={styles.panel}>
          <h2>{o("deliver")}</h2>
          <p className={styles.address}>{shipTo.recipient}<br />{shipTo.street}, {shipTo.ward}, {shipTo.province}<br />{shipTo.receiverPhone}</p>
        </section>
      </div>

      <section className={styles.panel}>
        <h2>{o("items")}</h2>
        <ul className={styles.rows}>
          {order.lines.map((line) => (
            <li key={line.id}>
              <div>
                <strong>{line.name} · No. {unitNumber(line.number)} / {unitNumber(line.size)}</strong><br />
                <span>{line.colour} · {line.drop}</span>
                {order.released.includes(line.id) && <> · <b className={styles.alert}>{t("notTheirs")}</b></>}
              </div>
              <strong>{formatVnd(line.priceVnd)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.split}>
        <section className={styles.panel}>
          <h2>{t("payments")}</h2>
          {order.payments.length === 0 ? <p className={styles.quiet}>{t("none")}</p> : (
            <ul className={styles.rows}>
              {order.payments.map((row) => (
                <li key={row.id}>
                  <div><strong>{formatVnd(row.amountVnd)}</strong><br /><span>{at(row.createdAt)} · {o(`methods.${row.provider}`)}</span></div>
                  <span className={styles.chip} data-status={row.status === "succeeded" ? "paid" : row.status === "pending" ? "pending" : "cancelled"}>{t(`paymentStatus.${row.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${styles.panel} ${order.owed.some((row) => row.status === "pending") ? styles.lead : ""}`}>
          <h2>{t("refunds")}</h2>
          {order.owed.length === 0 ? <p className={styles.quiet}>{t("none")}</p> : (
            <ul className={styles.rows}>
              {order.owed.map((row) => (
                <li key={row.id}>
                  <div><strong>{formatVnd(row.amountVnd)}</strong><br /><span>{at(row.createdAt)} · {row.reason ? t(`refundReason.${row.reason as "duplicate"}`) : "—"}</span></div>
                  <span className={styles.chip}>{row.status === "pending" ? t("notSent") : row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
