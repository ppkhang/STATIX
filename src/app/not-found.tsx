import Link from "next/link";
import { useTranslations } from "next-intl";
import ErrorScreen from "@/components/ErrorScreen";

export const metadata = { title: "Page not found | STATIX" };

/** Every unknown address, and every notFound() call. */
export default function NotFound() {
  const t = useTranslations("errorPage");

  return (
    <ErrorScreen code="404">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the landing needs a full load */}
      <a href="/">{t("home")}</a>
      <Link href="/drop/001">{t("drop")}</Link>
    </ErrorScreen>
  );
}
