import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
      <header className={styles.header}>
        <strong>{t("title")}</strong>
        {me && (
          <>
            <nav aria-label={t("menu")}>
              <Link href="/admin">{t("home")}</Link>
              {can(me.role, "dashboard") && <Link href="/admin/dashboard">{t("dashboard")}</Link>}
              {can(me.role, "drops") && <Link href="/admin/drops">{t("drops")}</Link>}
              {can(me.role, "orders") && <Link href="/admin/orders">{t("orders")}</Link>}
              {can(me.role, "audit") && <Link href="/admin/audit">{t("audit")}</Link>}
            </nav>
            <span>{me.email} · {t(`roles.${me.role}`)}</span>
            <form action={staffLogout}><button type="submit" className={authStyles.signOut}>{t("logOut")}</button></form>
          </>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
