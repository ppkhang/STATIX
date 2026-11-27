import Link from "next/link";
import { getTranslations } from "next-intl/server";
import card from "@/components/waitlist.module.css";

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountDeleted() {
  const t = await getTranslations("deleteAccount");
  const account = await getTranslations("account");
  return (
    <div className={card.card}>
      <h1>{t("doneTitle")}</h1>
      <div className={card.body}>
        <p className={card.line} role="status">{t("doneBody")}</p>
        <nav className={card.links}><Link href="/drop/001">{account("toDrop")}</Link></nav>
      </div>
    </div>
  );
}
