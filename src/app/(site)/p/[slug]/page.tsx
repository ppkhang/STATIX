import { Fragment } from "react";
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

export default async function Product({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const t = await getTranslations("product");
  const drop = await getDrop();
  const edition = drop?.editions.find((e) => e.slug === slug);
  if (!drop || !edition) notFound();

  const media = productMedia(slug);
  const content: ProductContent = productContent[slug]
    ?? { word: edition.name.toUpperCase(), kind: "", note: "", details: [], specs: [], inBox: [] };
  // every product in the drop, one card each, always in the same order
  const lineup = [...new Map(drop.editions.map((e) => [e.slug, e])).values()];
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
      <ProductView
        bands={tapes.map(([band, words], i) => {
          const line = `${words.join(" / ")} / `;
          return (
            <div key={band} className={`${styles.band} ${i ? styles.bandBottom : styles.bandTop}`} aria-hidden="true">
              {/* the landing's seamless loop: two identical halves, moved by half the track */}
              <div className="tape-track">
                {[0, 1].map((half) => (
                  <div key={half} className="tape-group">{[0, 1, 2].map((n) => <span key={n}>{line}</span>)}</div>
                ))}
              </div>
            </div>
          );
        })}
        key={slug} initial={drop} slug={slug} media={media} content={content}
        // everything handed to ProductView is built here on the server and set among its own elements there, so React
        // asks each for a key
        closeUps={closeUps.length > 0 && (
          <Fragment key="closeUps">
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
            {media.desk && (
              // eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses
              <img className={styles.desk} src={media.desk} alt={t("deskAlt", { name: edition.name })} loading="lazy" />
            )}
          </Fragment>
        )}
        specs={content.specs.length === 0 && content.inBox.length === 0 ? (
          <p key="specs" className={styles.soon}>{t("specsSoon")}</p>
        ) : (
          <div key="specs" className={styles.rows}>
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
        roster={(
          // keyed: ProductView sets this server-built element among its own children, and React asks for one
          <nav key="roster" className={styles.roster} aria-label={t("lineup")}>
            <ul>
              {lineup.map((item) => {
                const art = productMedia(item.slug).art;
                const card = (
                  <>
                    <span className={styles.face}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- same plain files the landing uses */}
                      {art && <img src={art} alt="" />}
                    </span>
                    <span className={styles.faceName} aria-hidden="true">{productContent[item.slug]?.word ?? item.name}</span>
                  </>
                );
                return (
                  <li key={item.slug}>
                    {item.slug === slug ? (
                      // where you are: lit, and not a link to itself
                      <span className={styles.card} aria-current="page">{card}<span className={styles.srOnly}>{item.name}</span></span>
                    ) : (
                      // data-switch: art-flight.js changes product with the wipe, and puts data-name on its cover
                      <Link className={styles.card} href={`/p/${item.slug}`} data-switch="" data-name={item.name} aria-label={item.name} title={item.name}>{card}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      />
    </div>
  );
}
