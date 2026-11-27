import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import styles from "@/components/checkout.module.css";
import card from "@/components/waitlist.module.css";
import { formatVnd } from "@/lib/format";
import { mockOutcome } from "@/lib/payment-actions";
import { mockPaymentsOn } from "@/lib/payment-rules";
import { findPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** The pretend provider's hosted page. It doesn't exist unless the mock is on. */
export default async function MockPayment({ params }: PageProps<"/pay/mock/[txn]">) {
  if (!mockPaymentsOn()) notFound();
  const me = await currentAccount();
  const { txn } = await params;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/pay/mock/${txn}`)}`);
  const attempt = await findPayment(me.id, txn);
  if (!attempt) notFound();
  const t = await getTranslations("mockPay");
  const o = await getTranslations("orders");
  const name = o(`methods.${attempt.provider}`);

  return (
    <div className={card.card}>
      <h1>{t("title")}</h1>
      <div className={card.body}>
        <p className={card.notice}>{t("note", { name })}</p>
        <p className={card.line}>{t("order", { number: attempt.orderNo })}</p>
        <dl className={styles.totals}><div className={styles.total}><dt>{t("amount")}</dt><dd>{formatVnd(attempt.amountVnd)}</dd></div></dl>
        {attempt.status === "pending" ? (
          <form action={mockOutcome} className={styles.actions}>
            <input type="hidden" name="txn" value={txn} />
            <button type="submit" name="outcome" value="success" className={card.primary}>{t("approve")}</button>
            <button type="submit" name="outcome" value="failed" className={card.secondary}>{t("decline")}</button>
            <button type="submit" name="outcome" value="cancelled" className={styles.release}>{t("cancel")}</button>
          </form>
        ) : (
          <>
            <p className={card.line} role="status">{t("done")}</p>
            <nav className={card.links}><Link href={`/account/orders/${attempt.orderNo}`}>{t("toOrder")}</Link></nav>
          </>
        )}
      </div>
    </div>
  );
}
