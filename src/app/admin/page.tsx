import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireStaff("home");
  const t = await getTranslations("admin");
  return (
    <>
      <h1>{t("home")}</h1>
      <p>{t("homeBody")}</p>
    </>
  );
}
