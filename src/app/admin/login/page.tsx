import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import StaffLogin from "@/components/StaffLogin";
import { currentStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

/** A1. */
export default async function StaffLoginPage() {
  if (await currentStaff()) redirect("/admin");
  const t = await getTranslations("admin");
  return (
    <>
      <h1>{t("logInTitle")}</h1>
      <StaffLogin />
    </>
  );
}
