import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getDrop } from "@/lib/catalogue";
import ProductGallery from "@/components/ProductGallery";
import ProductPanel from "@/components/ProductPanel";
import styles from "@/components/catalogue.module.css";

export const dynamic = "force-dynamic"; // stock and drop state are live

export default async function Product({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const t = await getTranslations("product");
  const drop = await getDrop();
  const edition = drop?.editions.find((e) => e.slug === slug);
  if (!drop || !edition) notFound();
  const others = [...new Map(drop.editions.filter((e) => e.slug !== slug).map((e) => [e.slug, e])).values()];

  return (
    <>
      <h1>{edition.name}</h1>
      <div className={styles.product}>
        <ProductGallery key={slug} slug={slug} name={edition.name} />
        <ProductPanel key={`panel-${slug}`} initial={drop} slug={slug} />
      </div>
      <h2>{t("pairsWith")}</h2>
      <ul className={styles.pairs}>
        {others.map((e) => (
          <li key={e.slug}><Link href={`/p/${e.slug}`}>{e.name}</Link></li>
        ))}
      </ul>
    </>
  );
}
