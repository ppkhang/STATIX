import { getTranslations, setRequestLocale } from "next-intl/server";

// Placeholder so the shared shell has a page to render; the real shop is M1.
export default async function Shop({ params }: PageProps<"/[locale]/shop">) {
  setRequestLocale((await params).locale);
  const t = await getTranslations("shop");
  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("soon")}</p>
    </>
  );
}
