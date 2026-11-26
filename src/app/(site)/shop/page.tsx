import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDrop } from "@/lib/catalogue";

export const dynamic = "force-dynamic"; // which drop is current is live

// Shop and Drop are one page for now: with a single drop they listed the same four products. The address stays,
// for old links, until there is something to browse beyond the current drop.
export default async function Shop() {
  const drop = await getDrop();
  if (drop) redirect(`/drop/${String(drop.number).padStart(3, "0")}`);
  const t = await getTranslations("shop");
  return <p>{t("empty")}</p>;
}
