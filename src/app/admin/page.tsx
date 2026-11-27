import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import styles from "@/components/admin.module.css";
import { can } from "@/lib/staff";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** No page of its own: on to the dashboard, or the first page this role may open. */
export default async function AdminIndex() {
  const me = await requireStaff("home");
  const first = (["dashboard", "drops", "orders", "audit"] as const).find((page) => can(me.role, page));
  if (first) redirect(`/admin/${first}`);
  // Support and Community have no pages yet
  const t = await getTranslations("admin");
  return (
    <>
      <h1>{t("title")}</h1>
      <p className={styles.note}>{t("noPages")}</p>
    </>
  );
}
