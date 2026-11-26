import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import ProductSwitch from "@/components/ProductSwitch";
import ProductView from "@/components/ProductView";
import styles from "@/components/product.module.css";
import { getDrop } from "@/lib/catalogue";
import { productContent, type ProductContent } from "@/lib/product-content";
import { productMedia } from "@/lib/product-media";

export const dynamic = "force-dynamic"; // stock and drop state are live

export default async function Product({ params, searchParams }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { view } = await searchParams; // a card's art flight asks to open on the illustration
  const t = await getTranslations("product");
  const drop = await getDrop();
  const edition = drop?.editions.find((e) => e.slug === slug);
  if (!drop || !edition) notFound();

  const media = productMedia(slug);
  const content: ProductContent = productContent[slug]
    ?? { word: edition.name.toUpperCase(), kind: "", note: "", details: [], specs: [], inBox: [] };
  const others = [...new Map(drop.editions.filter((e) => e.slug !== slug).map((e) => [e.slug, e])).values()];
  // a close-up shows once there is a real detail shot, or a main photo to cut it from
  const closeUps = content.details
    .map((detail, i) => ({ ...detail, file: media.details[i] }))
    .filter((detail) => detail.file ?? media.photo);
  const tapes = [
    ["tape-a", [edition.name, drop.name, "Numbered run", "No restocks"]],
    ["tape-b", ["Soft signal", content.kind || edition.name, "Tune in", content.word]],
  ] as const;

  return (
    // keyed, so a product change builds this page afresh instead of patching the last one
    <div key={slug} data-bleed data-product={slug} className={styles.page}>
      <ProductSwitch />
      <ProductView key={slug} initial={drop} slug={slug} media={media} content={content} openOnArt={view === "art"}>
        <div className={`tape-wrap ${styles.tapes}`} aria-hidden="true">
          {tapes.map(([band, words]) => {
            const line = `${words.join(" / ")} / `;
            return (
              <div key={band} className={`tape-band ${band}`}>
                {/* the landing's seamless loop: two identical halves, moved by half the track */}
                <div className="tape-track">
                  {[0, 1].map((half) => (
                    <div key={half} className="tape-group">{[0, 1, 2, 3].map((i) => <span key={i}>{line}</span>)}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {closeUps.length > 0 && (
          <section className={styles.close} aria-labelledby="close-title">
            <div className={styles.head}>
              <h2 id="close-title" className={`slab ${styles.heading}`}>{t("closeUp")}</h2>
              <p className={styles.aside} aria-hidden="true">{t("closeUpNote")}</p>
            </div>
            <ul className={styles.shots}>
              {closeUps.map((detail, i) => (
                <li key={detail.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses */}
                  <img
                    src={detail.file ?? media.photo} alt={`${edition.name}: ${detail.label}`} loading="lazy"
                    style={detail.file ? undefined : { objectPosition: `${detail.x}% ${detail.y}%`, transformOrigin: `${detail.x}% ${detail.y}%`, scale: String(detail.zoom) }}
                  />
                  <span className={styles.shotNo} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{detail.label}</h3>
                </li>
              ))}
            </ul>
          </section>
        )}

        {media.desk && (
          // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
          <img className={styles.desk} src={media.desk} alt={t("deskAlt", { name: edition.name })} loading="lazy" />
        )}

        <section className={styles.sheet} aria-labelledby="specs-title">
          <h2 id="specs-title" className={`slab ${styles.heading}`}>{t("specs")}</h2>
          {content.specs.length === 0 && content.inBox.length === 0 ? (
            <p className={styles.soon}>{t("specsSoon")}</p>
          ) : (
            <div className={styles.rows}>
              {content.specs.length > 0 && (
                <details open>
                  <summary>{t("specs")}</summary>
                  <dl>{content.specs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                </details>
              )}
              {content.inBox.length > 0 && (
                <details>
                  <summary>{t("inBox")}</summary>
                  <ul>{content.inBox.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </section>
      </ProductView>

      <section className={styles.mates} aria-labelledby="pairs-title">
        <h2 id="pairs-title" className={`slab ${styles.heading}`}>{t("pairsWith")}</h2>
        <ul>
          {others.map((other, i) => {
            const art = productMedia(other.slug);
            const word = productContent[other.slug]?.word ?? other.name;
            return (
              <li key={other.slug}>
                {/* the landing's lineup panel: photo at rest, comic art on hover or focus */}
                <Link href={`/p/${other.slug}`} data-art-fly={art.art ? "" : undefined} data-scroll-up="" className={`panel ${styles.mate}`} style={{ "--tilt": `${[-0.9, 0.7, -0.5][i % 3]}deg` } as React.CSSProperties}>
                  <span className="panel-shot">
                    {art.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
                      <img className="panel-photo" src={art.photo} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.mateBlank}>{word}</span>
                    )}
                    {art.art && (
                      <>
                        <span className="panel-back" data-word={`${word} / `.repeat(8)} aria-hidden="true"><i /><b /></span>
                        {/* eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses */}
                        <img className="panel-art" src={art.art} alt="" loading="lazy" />
                      </>
                    )}
                  </span>
                  <h3>{other.name}</h3>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
