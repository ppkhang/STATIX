import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { dropRun, edition, editionUnit, product, variant } from "@/db/schema";
import { dropStatus, type DropState } from "./drop-status";

export type Edition = {
  id: string; slug: string; name: string; colour: string;
  size: number; left: number; priceVnd: number;
};

export type DropSnapshot = {
  number: number; name: string; state: DropState; serverNow: string;
  earlyAccessAt: string | null; publicAt: string | null; nextAt: string | null;
  editions: Edition[];
};

/** One drop with its live counts, or the newest visible drop when no number is given. */
// shortcut: counts units on every poll; cache for 1-2 s (still inside NFR-004's 5 s) before drop-day traffic.
export async function getDrop(number?: number): Promise<DropSnapshot | null> {
  const [drop] = await db.select().from(dropRun)
    .where(and(ne(dropRun.state, "draft"), number === undefined ? undefined : eq(dropRun.number, number)))
    .orderBy(desc(dropRun.number)).limit(1);
  if (!drop) return null;

  const editions = await db.select({
    id: edition.id, slug: product.slug, name: product.name,
    colour: variant.colour, size: edition.size, priceVnd: edition.priceVnd,
    // a hold that has run out counts as left straight away: nothing has to sweep it (holds.ts takes it over)
    left: sql<number>`count(${editionUnit.id}) filter (where ${editionUnit.status} = 'available' or (${editionUnit.status} = 'held' and ${editionUnit.heldUntil} <= now()))::int`,
  }).from(edition)
    .innerJoin(variant, eq(edition.variantId, variant.id))
    .innerJoin(product, eq(variant.productId, product.id))
    .leftJoin(editionUnit, eq(editionUnit.editionId, edition.id))
    .where(eq(edition.dropId, drop.id))
    .groupBy(edition.id, product.id, variant.id)
    .orderBy(asc(product.sort), asc(variant.colour));

  const now = new Date();
  const status = dropStatus(drop, now, editions.reduce((sum, e) => sum + e.left, 0));
  if (!status) return null;
  return {
    number: drop.number, name: drop.name, state: status.state, serverNow: now.toISOString(),
    earlyAccessAt: drop.earlyAccessAt?.toISOString() ?? null,
    publicAt: drop.publicAt?.toISOString() ?? null,
    nextAt: status.nextAt?.toISOString() ?? null,
    editions,
  };
}

/** "001" -> 1; anything that is not a small positive number -> null. */
export const parseDropNumber = (raw: string) => (/^\d{1,6}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
