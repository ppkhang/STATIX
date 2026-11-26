import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getDrop } from "@/lib/catalogue";
import { editionState } from "@/lib/drop-status";
import { formatVnd } from "@/lib/format";
import { productMedia } from "@/lib/product-media";
import styles from "@/components/catalogue.module.css";

export const dynamic = "force-dynamic"; // stock and drop state are live

export default async function Shop() {
  const t = await getTranslations("shop");
  const d = await getTranslations("drop");
  const drop = await getDrop();
  // one card per product, even once a product has several colours
  const slugs = [...new Set(drop?.editions.map((e) => e.slug))];

  return (
    <>
      <h1>{t("title")}</h1>
      {slugs.length === 0 && <p>{t("empty")}</p>}
      <ul className={styles.grid}>
        {slugs.map((slug) => {
          const editions = drop!.editions.filter((e) => e.slug === slug);
          const name = editions[0].name;
          const media = productMedia[slug];
          const left = editions.reduce((sum, e) => sum + e.left, 0);
          return (
            <li key={slug}>
              <Link href={`/p/${slug}`} className={styles.card}>
                <span className={media ? styles.shot : `${styles.shot} ${styles.noShot}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses */}
                  {media ? <img src={media.photo} alt="" /> : t("noPhoto")}
                </span>
                <span className={styles.badge}>{d(`state.${editionState(drop!.state, left)}`)}</span>
                <h2>{name}</h2>
                <strong>{formatVnd(Math.min(...editions.map((e) => e.priceVnd)))}</strong>
                <span>{t("editionSize", { size: editions.reduce((sum, e) => sum + e.size, 0) })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
