"use client"; // error boundaries must be Client Components

import { useTranslations } from "next-intl";
import ErrorScreen from "@/components/ErrorScreen";

/** A page that crashed. The error itself is not shown: in production it carries nothing a visitor can use. */
export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("errorPage");

  return (
    <ErrorScreen code="500">
      <button type="button" onClick={() => retry()}>{t("retry")}</button>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load also clears the crashed state */}
      <a href="/">{t("home")}</a>
    </ErrorScreen>
  );
}
