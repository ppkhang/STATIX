import { useTranslations } from "next-intl";
import styles from "./catalogue.module.css";

export default function LeftBar({ left, size }: { left: number; size: number }) {
  const t = useTranslations("drop");
  return (
    <div className={styles.leftWrap}>
      <span>{t("editionLeft", { size, left })}</span>
      <span className={styles.bar} aria-hidden="true"><span style={{ width: `${(left / size) * 100}%` }} /></span>
    </div>
  );
}
