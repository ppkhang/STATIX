// Seeds tiers, the four products and Drop 001 with 500-unit editions. Safe to run twice.
// Run: npm run db:seed
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { dropRun, edition, editionUnit, product, setting, tier, variant } from "../src/db/schema";

// [ASSUMPTION] prices: USD list prices from the business analysis at 26,000 VND/USD, rounded. VAT included.
// [ASSUMPTION] one colour per product until the variant list is decided.
const PRODUCTS = [
  { slug: "static-one", skuFamily: "ONE", name: "Static One", colour: "Clear", price: 5_190_000 },
  { slug: "signal", skuFamily: "SIGNAL", name: "Static Signal", colour: "Clear", price: 3_350_000 },
  { slug: "stand", skuFamily: "STAND", name: "Static Stand", colour: "Violet", price: 1_530_000 },
  { slug: "wire", skuFamily: "WIRE", name: "Static Wire", colour: "Black", price: 910_000 },
];
const EDITION_SIZE = 500;

async function main() {
  await db.insert(tier).values([
    { code: "visitor", earlyAccessMinutes: 0 },
    { code: "waitlist", earlyAccessMinutes: 30 },
    { code: "member", earlyAccessMinutes: 30 },
    { code: "founder", earlyAccessMinutes: 30 },
  ]).onConflictDoNothing();

  await db.insert(setting).values([
    { key: "hold_minutes", value: 10 },
    { key: "hold_extension_minutes", value: 10 },
    { key: "default_cap", value: 1 },
    { key: "cod_limit_vnd", value: 10_000_000 }, // [ASSUMPTION]
  ]).onConflictDoNothing();

  await db.insert(dropRun).values({
    number: 1,
    name: "Drop 001",
    state: "scheduled",
    earlyAccessAt: new Date("2026-12-20T19:30:00+07:00"), // members get 30 minutes first
    publicAt: new Date("2026-12-20T20:00:00+07:00"),
  }).onConflictDoNothing();
  const [drop] = await db.select().from(dropRun).where(sql`${dropRun.number} = 1`);

  for (const [i, p] of PRODUCTS.entries()) {
    await db.insert(product).values({ slug: p.slug, skuFamily: p.skuFamily, name: p.name, sort: i })
      .onConflictDoNothing();
    const [prod] = await db.select().from(product).where(sql`${product.slug} = ${p.slug}`);

    await db.insert(variant).values({ productId: prod.id, colour: p.colour, listPriceVnd: p.price }).onConflictDoNothing();
    const [v] = await db.select().from(variant).where(sql`${variant.productId} = ${prod.id} and ${variant.colour} = ${p.colour}`);

    await db.insert(edition).values({ dropId: drop.id, variantId: v.id, size: EDITION_SIZE, priceVnd: p.price, perPersonCap: 1 })
      .onConflictDoNothing();
    const [ed] = await db.select().from(edition).where(sql`${edition.dropId} = ${drop.id} and ${edition.variantId} = ${v.id}`);

    // Pre-create units 1..N (06 §2); the unique (edition_id, number) makes reruns a no-op.
    await db.execute(sql`
      insert into ${editionUnit} (edition_id, number)
      select ${ed.id}, n from generate_series(1, ${ed.size}) as n
      on conflict do nothing`);
  }

  const counts = await db.execute(sql`
    select p.slug, count(u.*)::int as units
    from ${product} p join ${variant} v on v.product_id = p.id
    join ${edition} e on e.variant_id = v.id join ${editionUnit} u on u.edition_id = e.id
    group by p.slug order by p.slug`);
  console.table(counts.rows);
  const wrong = counts.rows.filter((r) => r.units !== EDITION_SIZE);
  if (counts.rows.length !== PRODUCTS.length || wrong.length) throw new Error("Seed check failed: expected 4 editions of 500 units");
  console.log("Seed OK");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
