import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { currentAccount } from "@/auth";
import { logout } from "@/lib/auth-actions";
import authStyles from "@/components/auth.module.css";
import styles from "@/components/shell.module.css";

// Shared shell for every customer page except the landing, which keeps its own menu.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("shell");
  const me = await currentAccount();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* Plain <a>: the landing script only runs on a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={styles.logo} href="/" aria-label={t("home")}>STATIX</a>
        <nav className={styles.links} aria-label={t("menu")}>
          <Link href="/shop">{t("shop")}</Link>
          <Link href="/drop/001">{t("drop")}</Link>
          {me ? (
            <>
              <Link href="/account">{t("account")}</Link>
              <form action={logout}><button type="submit" className={authStyles.signOut}>{t("signOut")}</button></form>
            </>
          ) : (
            <Link href="/login">{t("signIn")}</Link>
          )}
          <Link href="/cart">{t("cart", { count: 0 })}</Link>
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span className={styles.logo}>STATIX</span>
        <nav className={styles.links} aria-label={t("footerNav")}>
          <Link href="/shop">{t("shop")}</Link>
          <Link href="/drop/001">{t("drop")}</Link>
          <Link href="/support">{t("support")}</Link>
          <Link href="/terms">{t("terms")}</Link>
          <Link href="/returns">{t("returns")}</Link>
          <Link href="/privacy-policy">{t("privacy")}</Link>
        </nav>
        <small>{t("copyright")}</small>
      </footer>
    </div>
  );
}
