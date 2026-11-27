import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import AddressForm from "@/components/AddressForm";
import styles from "@/components/checkout.module.css";
import card from "@/components/waitlist.module.css";
import { listAddresses, MAX_ADDRESSES } from "@/lib/addresses";
import { deleteAddress, setDefaultAddress } from "@/lib/checkout-actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Page 16. shortcut: province and ward are typed, not picked from a list; swap in pickers (INT-14) once there is a
 * two-level address source.
 */
export default async function Addresses({ searchParams }: PageProps<"/account/addresses">) {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/addresses");
  const { edit, done } = await searchParams;
  const t = await getTranslations("addresses");
  const account = await getTranslations("account");
  const rows = await listAddresses(me.id);
  const editing = rows.find((row) => row.id === edit);
  const hidden = (id: string) => <input type="hidden" name="id" value={id} />;

  return (
    <div className={card.card}>
      <h1>{t("title")}</h1>
      <div className={card.body}>
        {(done === "saved" || done === "default" || done === "deleted") && <p className={card.notice} role="status">{t(`done.${done}`)}</p>}
        <p className={card.line}>{rows.length ? t("defaultNote") : t("empty")}</p>

        {rows.map((row) => (
          <article key={row.id} className={styles.held}>
            <p className={card.line}>
              <strong>{row.recipient}</strong>{row.isDefault && <> · {t("default")}</>}<br />
              {row.street}, {row.ward}, {row.province}<br />
              {row.receiverPhone}
            </p>
            <div className={styles.actions}>
              <Link href={`/account/addresses?edit=${row.id}#address-form`} className={styles.release}>{t("edit")}</Link>
              {!row.isDefault && (
                <form action={setDefaultAddress}>{hidden(row.id)}<button type="submit" className={card.secondary}>{t("makeDefault")}</button></form>
              )}
              <details>
                <summary className={styles.release}>{t("delete")}</summary>
                <form action={deleteAddress} className={styles.actions}>
                  {hidden(row.id)}<span>{t("deleteAsk")}</span><button type="submit" className={card.secondary}>{t("deleteConfirm")}</button>
                </form>
              </details>
            </div>
          </article>
        ))}

        <section className={card.section} id="address-form">
          <h2>{editing ? t("editTitle") : t("add")}</h2>
          {editing || rows.length < MAX_ADDRESSES ? (
            // keyed by what it edits, so the fields start over when that changes
            <AddressForm key={editing?.id ?? `new-${rows.length}`} id={editing?.id ?? "new"} saved={editing ?? null} />
          ) : (
            <p className={card.line}>{t("full", { max: MAX_ADDRESSES })}</p>
          )}
          {editing && <nav className={card.links}><Link href="/account/addresses">{t("cancel")}</Link></nav>}
        </section>

        <nav className={card.links}><Link href="/account">{account("back")}</Link></nav>
      </div>
    </div>
  );
}
