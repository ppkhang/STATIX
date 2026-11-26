import { getTranslations } from "next-intl/server";
import styles from "./catalogue.module.css";

/** FR-053 pages. The wording is a placeholder until the real policies are written (M7). */
export default async function PolicyPage({ policy }: { policy: "terms" | "returns" | "privacy" }) {
  const t = await getTranslations("policy");
  return (
    <>
      <h1>{t(`${policy}.title`)}</h1>
      <p className={styles.badge}>{t("draft")}</p>
      <p>{t(`${policy}.body`)}</p>
      <p>{t("updated", { date: "26/11/2026" })}</p>
    </>
  );
}
