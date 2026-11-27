"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./auth.module.css";

const TABS = [
  { href: "/login", label: "loginTitle" },
  { href: "/register", label: "registerTitle" },
] as const;

/** The header of the log in and sign up box. `.slab` is the landing's title block, from globals.css. */
export default function AuthTabs() {
  const t = useTranslations("auth");
  const path = usePathname();

  return (
    <nav className={`slab ${styles.title}`}>
      {TABS.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={href === path ? "page" : undefined}>
          {href === path ? <h1>{t(label)}</h1> : t(label)}
        </Link>
      ))}
      {/* the light bar behind the current tab; it comes after the links so CSS can read which one that is */}
      <span aria-hidden="true" />
    </nav>
  );
}
