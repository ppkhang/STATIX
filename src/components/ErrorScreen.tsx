import { useTranslations } from "next-intl";
import styles from "./error.module.css";

type Props = {
  code: "404" | "500";
  /** The ways out, as links or buttons. The first one leads. */
  children: React.ReactNode;
};

/**
 * The 404 and crash pages.
 * Full screen with its own wordmark, because it replaces the site's header too. No client code of its own:
 * Next sends the root not-found with every page.
 */
export default function ErrorScreen({ code, children }: Props) {
  const t = useTranslations(`errorPage.${code}`);

  return (
    <main className={styles.screen}>
      {/* Plain <a>: the landing script only runs on a full page load. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className={styles.logo} href="/">STATIX</a>
      <div className={styles.art} aria-hidden="true">
        <span className={styles.code}>{code}</span>
        <p className={styles.tape}>{`${t("tape")} / `.repeat(12)}</p>
      </div>
      <h1 className={`slab ${styles.title}`}>{t("title")}</h1>
      <p className={styles.aside}>{t("aside")}</p>
      <div className={styles.actions}>{children}</div>
    </main>
  );
}
