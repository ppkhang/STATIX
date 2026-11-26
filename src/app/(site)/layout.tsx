import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { currentAccount } from "@/auth";
import { logout } from "@/lib/auth-actions";
import NavLink from "@/components/NavLink";
import { HeaderSwitch } from "@/components/ProductSwitch";
import authStyles from "@/components/auth.module.css";
import styles from "@/components/shell.module.css";

// Shared shell for every customer page except the landing, which keeps its own menu.
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("shell");
  const me = await currentAccount();

  return (
    <div className={styles.page}>
      <HeaderSwitch />
      <header className={styles.header}>
        {/* Plain <a>: the landing script only runs on a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className={styles.logo} href="/" aria-label={t("home")} data-home="">STATIX</a>
        {/* only what matters off the landing: the drop, and you. Lineup and Vote are sections of the landing, so they stay in its menu */}
        <nav className={styles.links} aria-label={t("menu")}>
          <div className={styles.group}>
            {/* a product belongs to the drop, so product pages light this up too */}
            <NavLink href="/drop/001" within={["/drop", "/p"]}>{t("drop")}</NavLink>
          </div>
          <div className={`${styles.group} ${styles.you}`}>
            {me ? (
              <>
                <NavLink href="/account" within={["/account"]}>{t("account")}</NavLink>
                <form action={logout}><button type="submit" className={authStyles.signOut}>{t("signOut")}</button></form>
              </>
            ) : (
              <NavLink href="/login" within={["/register", "/verify", "/reset"]}>{t("signIn")}</NavLink>
            )}
          </div>
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        {/* data-not-on-entry: log in and sign up leave these out (shell.module.css) */}
        <span className={styles.logo} data-not-on-entry="">STATIX</span>
        <nav className={styles.links} aria-label={t("footerNav")}>
          <Link href="/drop/001" data-not-on-entry="">{t("drop")}</Link>
          {/* the policies are only down here, so this is where they show you're on them */}
          <NavLink href="/terms">{t("terms")}</NavLink>
          <NavLink href="/returns">{t("returns")}</NavLink>
          <NavLink href="/privacy-policy">{t("privacy")}</NavLink>
        </nav>
        <small>{t("copyright")}</small>
      </footer>
    </div>
  );
}
