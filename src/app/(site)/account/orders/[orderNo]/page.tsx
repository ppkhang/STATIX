import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import Toast from "@/components/Toast";
import styles from "@/components/checkout.module.css";
import card from "@/components/waitlist.module.css";
import type { Address } from "@/lib/checkout-rules";
import { formatDateTime, formatVnd, unitNumber } from "@/lib/format";
import { timeline } from "@/lib/order-rules";
import { findOrder } from "@/lib/orders";
import { cancelMyOrder } from "@/lib/payment-actions";
import { CANCELLABLE, expireStaleOrders } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Page 14, one order. Not built: invoice and return request.
 * shortcut: no time per step and tracking codes aren't links; add both once something records status changes
 * and there is a GHN account.
 */
export default async function Order({ params, searchParams }: PageProps<"/account/orders/[orderNo]">) {
  const me = await currentAccount();
  const { orderNo } = await params;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/account/orders/${orderNo}`)}`);
  await expireStaleOrders(me.id);
  const { placed, cancelled } = await searchParams;
  // someone else's order number gets the same 404 as one that doesn't exist
  const order = await findOrder(me.id, orderNo);
  if (!order) notFound();
  const t = await getTranslations("orders");
  const steps = timeline(order.status, order.paymentMethod);
  // the address as it was when the order was made
  const shipTo = order.shipTo as Address;
  const tracked = order.shipments.filter((row) => row.trackingCode);

  return (
    <div className={card.card}>
      <h1>{t("order", { number: order.orderNo })}</h1>
      <div className={card.body}>
        {/* page 12. The status is read from the order, so the address alone can't make this show */}
        {placed === "1" && order.status === "paid" && <Toast key={randomUUID()} param="placed" message={t("confirmed")} />}
        {cancelled === "1" && order.status === "cancelled" && <Toast key={randomUUID()} param="cancelled" message={t("cancelledNow")} />}
        {order.status === "refunded" && <p className={card.notice}>{t("refundedNote")}</p>}
        {order.refunds.map((row) => (
          <p key={row.id} className={card.line}>{t(row.status === "pending" ? "refundDue" : "refundOther", { amount: formatVnd(row.amountVnd) })}</p>
        ))}
        <p className={card.lead}>{t(`status.${order.status}`)}</p>
        <p className={card.line}>
          {t("placed", { time: formatDateTime(order.createdAt.toISOString()) })}<br />
          {t("method")}: {t(`methods.${order.paymentMethod}`)}
        </p>

        {steps && (
          <section className={card.section}>
            <h2>{t("progress")}</h2>
            <ol className={styles.steps}>
              {steps.map((step) => (
                <li key={step.status} data-state={step.state} aria-current={step.state === "now" ? "step" : undefined}>
                  {t(`status.${step.status}`)}
                  {step.state !== "later" && <span className={styles.srOnly}> ({t(step.state === "now" ? "current" : "complete")})</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className={card.section}>
          <h2>{t("items")}</h2>
          {order.lines.map((line) => (
            <div key={line.id} className={styles.held}>
              <p className={styles.item}>
                <strong>{line.name}</strong>
                <span>No. {unitNumber(line.number)} / {unitNumber(line.size)} · {line.colour} · {line.drop}</span>
                <b>{formatVnd(line.priceVnd)}</b>
              </p>
            </div>
          ))}
          <dl className={styles.totals}>
            <div><dt>{t("subtotal")}</dt><dd>{formatVnd(order.subtotalVnd)}</dd></div>
            <div><dt>{t("shipping")}</dt><dd>{formatVnd(order.shippingVnd)}</dd></div>
            <div className={styles.total}><dt>{t("total")}</dt><dd>{formatVnd(order.totalVnd)}</dd></div>
          </dl>
        </section>

        <section className={card.section}>
          <h2>{t("deliver")}</h2>
          <p className={card.line}>{shipTo.recipient}<br />{shipTo.street}, {shipTo.ward}, {shipTo.province}<br />{shipTo.receiverPhone}</p>
        </section>

        {tracked.length > 0 && (
          <section className={card.section}>
            <h2>{t("tracking")}</h2>
            {tracked.map((row) => <p key={row.id} className={card.line}>{row.carrier.toUpperCase()} · {row.trackingCode}</p>)}
          </section>
        )}

        {(CANCELLABLE as readonly string[]).includes(order.status) && (
          // opening this is the "are you sure" step
          <details>
            <summary className={styles.release}>{t("cancel")}</summary>
            <form action={cancelMyOrder} className={styles.actions}>
              <input type="hidden" name="order" value={order.orderNo} />
              <span>{t(order.paymentMethod === "cod" ? "cancelAskCod" : "cancelAsk")}</span>
              <button type="submit" className={card.secondary}>{t("cancelConfirm")}</button>
            </form>
          </details>
        )}

        <nav className={card.links}><Link href="/account/orders">{t("back")}</Link></nav>
      </div>
    </div>
  );
}
