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
      <nav><Link href="/admin/orders">{t("allOrders")}</Link></nav>
      <h1>{order.orderNo} <span className={styles.chip}>{o(`status.${order.status}`)}</span></h1>
      <dl className={styles.facts}>
        <dt>{t("when")}</dt><dd>{at(order.createdAt)}</dd>
        <dt>{t("customer")}</dt><dd>{order.email}</dd>
        <dt>{o("deliver")}</dt><dd>{shipTo.recipient}, {shipTo.street}, {shipTo.ward}, {shipTo.province} · {shipTo.receiverPhone}</dd>
        <dt>{o("total")}</dt><dd>{formatVnd(order.totalVnd)} ({o("shipping")}: {formatVnd(order.shippingVnd)})</dd>
        {steps && <><dt>{o("progress")}</dt><dd>{steps.map((step) => `${step.state === "now" ? "▸ " : ""}${o(`status.${step.status}`)}`).join(" · ")}</dd></>}
      </dl>

      <h2>{o("items")}</h2>
      <ul>
        {order.lines.map((line) => (
          <li key={line.id}>
            {line.name} · {line.colour} · No. {unitNumber(line.number)} / {unitNumber(line.size)} · {line.drop} · {formatVnd(line.priceVnd)}
            {order.released.includes(line.id) && <> · <strong>{t("notTheirs")}</strong></>}
          </li>
        ))}
      </ul>

      <h2>{t("payments")}</h2>
      {order.payments.length === 0 ? <p>{t("none")}</p> : (
        <ul>
          {order.payments.map((row) => (
            <li key={row.id}>{at(row.createdAt)} · {o(`methods.${row.provider}`)} · {formatVnd(row.amountVnd)} · {t(`paymentStatus.${row.status}`)}</li>
          ))}
        </ul>
      )}

      <h2>{t("refunds")}</h2>
      {order.owed.length === 0 ? <p>{t("none")}</p> : (
        <ul>
          {order.owed.map((row) => (
            <li key={row.id}>
              {at(row.createdAt)} · {formatVnd(row.amountVnd)} · {row.reason ? t(`refundReason.${row.reason as "duplicate"}`) : "—"} · {row.status === "pending" ? <strong>{t("notSent")}</strong> : row.status}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
