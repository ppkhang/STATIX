import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AddressForm from "@/components/AddressForm";
import styles from "@/components/checkout.module.css";
import HoldTimer from "@/components/HoldTimer";
import card from "@/components/waitlist.module.css";
import { listAddresses } from "@/lib/addresses";
import { extend, release, setDefaultAddress } from "@/lib/checkout-actions";
import { shippingEstimateVnd } from "@/lib/checkout-rules";
import { formatVnd, unitNumber } from "@/lib/format";
import { activeHolds } from "@/lib/holds";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Page 10, up to payment: the held units and their timers, where to send them, and what they'd cost. */
export default async function Checkout({ searchParams }: PageProps<"/checkout">) {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/checkout");
  const { released, saved } = await searchParams;
  const t = await getTranslations("checkout");
  const holds = await activeHolds(me.id);
  const book = await listAddresses(me.id);
  const delivery = book.find((row) => row.isDefault);
  const others = book.filter((row) => !row.isDefault);
  const now = new Date().toISOString();

  const shell = (title: string, body: React.ReactNode) => (
    <div className={card.card}>
      <h1>{title}</h1>
      <div className={card.body}>{body}</div>
    </div>
  );
  if (holds.length === 0) {
    return shell(t("emptyTitle"), (
      <>
        {/* a run-out hold and no hold look the same from here, so say both things that help */}
        <p className={card.line} role="status">{t(released === "1" ? "released" : "emptyBody")}</p>
        <nav className={card.links}><Link href="/drop/001">{t("toDrop")}</Link></nav>
      </>
    ));
  }

  const items = holds.reduce((sum, h) => sum + h.priceVnd, 0);
  const shipping = delivery ? shippingEstimateVnd(delivery.province) : null;

  return shell(t("title"), (
    <>
      <section className={card.section}>
        <h2>{t("yours")}</h2>
        {holds.map((held) => {
          const unit = `No. ${unitNumber(held.number)} / ${unitNumber(held.size)}`;
          return (
            <article key={held.id} className={styles.held}>
              <p className={styles.item}><strong>{held.name}</strong><span>{held.colour} · {held.drop}</span><b>{formatVnd(held.priceVnd)}</b></p>
              {/* keyed by the deadline, so extending starts a fresh count */}
              <HoldTimer key={held.expiresAt.toISOString()} unit={unit} expiresAt={held.expiresAt.toISOString()} now={now} />
              <div className={styles.actions}>
                {held.extensions === 0 && (
                  <form action={extend}>
                    <input type="hidden" name="hold" value={held.id} />
                    <button type="submit" className={card.secondary}>{t("extend")}</button>
                  </form>
                )}
                <form action={release}>
                  <input type="hidden" name="hold" value={held.id} />
                  <button type="submit" className={styles.release}>{t("release")}</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      <section className={card.section}>
        <h2>{t("contact")}</h2>
        <p className={card.line}>{me.email}<br />{me.phone}</p>
      </section>

      <section className={card.section}>
        <h2>{t("deliver")}</h2>
        {saved === "1" && <p className={card.notice} role="status">{t("addressSaved")}</p>}
        <AddressForm key={delivery?.id ?? "none"} saved={delivery ?? null} />
        {others.length > 0 && (
          // picked here, not in the address book, so nobody walks away from a running hold
          <details>
            <summary className={styles.release}>{t("otherAddress")}</summary>
            {others.map((row) => (
              <form key={row.id} action={setDefaultAddress} className={styles.actions}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="from" value="checkout" />
                <span>{row.recipient}, {row.street}, {row.ward}, {row.province}</span>
                <button type="submit" className={card.secondary}>{t("deliverHere")}</button>
              </form>
            ))}
          </details>
        )}
      </section>

      <section className={card.section}>
        <h2>{t("summary")}</h2>
        <dl className={styles.totals}>
          <div><dt>{t("items", { count: holds.length })}</dt><dd>{formatVnd(items)}</dd></div>
          <div><dt>{t("shipping")}</dt><dd>{shipping === null ? t("needAddress") : formatVnd(shipping)}</dd></div>
          <div className={styles.total}><dt>{t("total")}</dt><dd>{shipping === null ? "—" : formatVnd(items + shipping)}</dd></div>
        </dl>
        <p className={card.line}>{t("totalNote")}</p>
      </section>

      <section className={card.section}>
        <h2>{t("payment")}</h2>
        <p className={card.line}>{t("noPayment")}</p>
        <button type="button" className={card.primary} disabled>{t("pay")}</button>
      </section>
    </>
  ));
}
