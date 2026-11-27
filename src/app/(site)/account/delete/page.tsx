import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import DeleteAccount from "@/components/DeleteAccount";
import card from "@/components/waitlist.module.css";
import { deleteBlock } from "@/lib/account-delete";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function DeleteAccountPage() {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/delete");
  const t = await getTranslations("deleteAccount");
  const account = await getTranslations("account");
  const blocked = await deleteBlock(me.id);

  return (
    <div className={card.card}>
      <h1>{t("title")}</h1>
      <div className={card.body}>
        <p className={card.line}>{t("goes")}</p>
        <p className={card.line}>{t("stays")}</p>
        {blocked ? <p className={card.notice}>{t(`error.${blocked}`)}</p> : <DeleteAccount needsPassword={Boolean(me.passwordHash)} />}
        <nav className={card.links}><Link href="/account">{account("back")}</Link></nav>
      </div>
    </div>
  );
}
