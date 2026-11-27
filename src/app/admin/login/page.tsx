import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import StaffLogin from "@/components/StaffLogin";
import styles from "@/components/admin.module.css";
import { currentStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A1. */
export default async function StaffLoginPage() {
  if (await currentStaff()) redirect("/admin");
  const t = await getTranslations("admin");
  return (
    <>
      <h1>{t("logInTitle")}</h1>
      <div className={`${styles.panel} ${styles.narrow}`}><StaffLogin /></div>
    </>
  );
}
