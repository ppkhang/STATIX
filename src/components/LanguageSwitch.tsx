"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./shell.module.css";

export default function LanguageSwitch() {
  const t = useTranslations("shell");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav className={styles.lang} aria-label={t("language")}>
      {routing.locales.map((l) => (
        <Link key={l} href={pathname} locale={l} aria-current={l === locale ? "true" : undefined} lang={l}>
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
