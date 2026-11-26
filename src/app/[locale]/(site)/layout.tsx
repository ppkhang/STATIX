import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LanguageSwitch from "@/components/LanguageSwitch";
import styles from "@/components/shell.module.css";

// Shared shell for every customer page except the landing, which keeps its own menu.
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("shell");
  // Plain <a> to the landing: its script only runs on a full page load.
  const home = (await getLocale()) === "vi" ? "/" : "/en";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href={home} aria-label={t("home")}>STATIX</a>
        <nav className={styles.links} aria-label={t("menu")}>
          <Link href="/shop">{t("shop")}</Link>
          <a href={`${home === "/" ? "" : home}/#drop`}>{t("drop")}</a>
          <Link href="/login">{t("signIn")}</Link>
          <Link href="/cart">{t("cart", { count: 0 })}</Link>
        </nav>
        <LanguageSwitch />
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span className={styles.logo}>STATIX</span>
        <nav className={styles.links} aria-label={t("footerNav")}>
          <Link href="/shop">{t("shop")}</Link>
          <a href={`${home === "/" ? "" : home}/#drop`}>{t("drop")}</a>
          <Link href="/support">{t("support")}</Link>
          <Link href="/terms">{t("terms")}</Link>
          <Link href="/returns">{t("returns")}</Link>
          <Link href="/privacy-policy">{t("privacy")}</Link>
        </nav>
        <LanguageSwitch />
        <small>{t("copyright")}</small>
      </footer>
    </div>
  );
}
