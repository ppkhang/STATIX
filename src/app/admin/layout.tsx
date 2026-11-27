import { getTranslations } from "next-intl/server";
import NavLink from "@/components/NavLink";
import SignalBackdrop from "@/components/SignalBackdrop";
import authStyles from "@/components/auth.module.css";
import styles from "@/components/admin.module.css";
import { staffLogout } from "@/lib/staff-actions";
import { can } from "@/lib/staff";
import { currentStaff } from "@/lib/staff-session";

// NFR-022: nothing staff-only goes into search results
export const metadata = { title: "STATIX admin", robots: { index: false, follow: false } };

// A plain shell for staff. It only decides which links to show: each page checks access itself.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = await getTranslations("admin");
  const me = await currentStaff();
  return (
    <div className={styles.page}>
      {/* still: only the pointer lights it, as there's nothing here to pause it with */}
      <div className={styles.art}><SignalBackdrop still /></div>
      <header className={styles.header}>
        <span className={styles.brand}><span className={styles.logo}>STATIX</span><span className={styles.tag}>{t("tag")}</span></span>
        {me && (
          <>
            <nav aria-label={t("menu")}>
              {can(me.role, "dashboard") && <NavLink href="/admin/dashboard" within={["/admin/dashboard"]}>{t("dashboard")}</NavLink>}
              {can(me.role, "drops") && <NavLink href="/admin/drops" within={["/admin/drops"]}>{t("drops")}</NavLink>}
              {can(me.role, "orders") && <NavLink href="/admin/orders" within={["/admin/orders"]}>{t("orders")}</NavLink>}
              {can(me.role, "audit") && <NavLink href="/admin/audit" within={["/admin/audit"]}>{t("audit")}</NavLink>}
            </nav>
            <span className={styles.who}>{me.email} · {t(`roles.${me.role}`)}</span>
            <form action={staffLogout}><button type="submit" className={authStyles.signOut}>{t("logOut")}</button></form>
          </>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
