// A3 and A4: making, scheduling and filling drops (FR-007 to FR-009, FR-097).
// The role check and the audit row live here, with the change, so no route to a change can skip either.
// Relative imports, so scripts/check-drops.ts can run this outside Next.
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { dropRun, edition, editionUnit, product, variant } from "../db/schema";
import { detailsProblem, editionProblem, salesStarted, scheduleProblem, type DropDetails, type EditionTerms } from "./drop-admin-rules";
import { audit, can, type Staff } from "./staff";

export type DropProblem =
  | "denied" | "gone" | "locked" | "badNumber" | "numberTaken" | "unitsInUse" | "variantTaken" | "notDraft" | "noEditions" | "unitCount"
  | NonNullable<ReturnType<typeof detailsProblem>> | NonNullable<ReturnType<typeof editionProblem>> | NonNullable<ReturnType<typeof scheduleProblem>>;
export type Result = { ok: true } | { ok: false; error: DropProblem };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DropRow = typeof dropRun.$inferSelect;

/** Thrown to undo everything done so far in the transaction. */
class Refused extends Error {
  constructor(readonly problem: DropProblem) { super(problem); }
}

async function change(actor: Staff, work: (tx: Tx) => Promise<void>): Promise<Result> {
  if (!can(actor.role, "drops")) return { ok: false, error: "denied" };
  try {
    await db.transaction(work);
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.problem };
    throw error;
  }
}

/**
 * One staff change per drop at a time. "no key update", so a buyer's hold, which only points at these rows, never
 * waits on this lock: a stronger one could deadlock with the unit row a hold has taken.
 */
async function lockDrop(tx: Tx, number: number): Promise<DropRow> {
  const [drop] = await tx.select().from(dropRun).where(eq(dropRun.number, number)).for("no key update");
  if (!drop) throw new Refused("gone");
  return drop;
}

const details = ({ name, earlyAccessAt, publicAt, closeAt }: DropDetails) => ({ name, earlyAccessAt, publicAt, closeAt });

export async function createDrop(actor: Staff, number: number, input: DropDetails): Promise<Result> {
  const problem = !Number.isInteger(number) || number < 1 || number > 999_999 ? "badNumber" as const : detailsProblem(input);
  if (problem) return { ok: false, error: problem };
  return change(actor, async (tx) => {
    const [made] = await tx.insert(dropRun).values({ number, ...details(input), state: "draft" })
      .onConflictDoNothing().returning({ id: dropRun.id });
    if (!made) throw new Refused("numberTaken");
    await audit({ adminId: actor.id, entity: "drop", entityId: made.id, action: "create", newValue: { number, ...details(input) } }, tx);
  });
}

/** Name and times, until selling starts. A scheduled drop has to stay schedulable. */
export async function updateDrop(actor: Staff, number: number, input: DropDetails): Promise<Result> {
  const problem = detailsProblem(input);
  if (problem) return { ok: false, error: problem };
  return change(actor, async (tx) => {
    const drop = await lockDrop(tx, number);
    const now = new Date();
    if (salesStarted(drop, now)) throw new Refused("locked");
    if (drop.state !== "draft") {
      const unschedulable = scheduleProblem(input, now);
      if (unschedulable) throw new Refused(unschedulable);
    }
    const [before, after] = [details(drop), details(input)];
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    await tx.update(dropRun).set(after).where(eq(dropRun.id, drop.id));
    await audit({ adminId: actor.id, entity: "drop", entityId: drop.id, action: "update", oldValue: before, newValue: after }, tx);
  });
}

/** Draft to Scheduled, the only move staff make here: the clock does the rest (US-009 AC2). */
export async function scheduleDrop(actor: Staff, number: number): Promise<Result> {
  return change(actor, async (tx) => {
    const drop = await lockDrop(tx, number);
    if (drop.state !== "draft") throw new Refused("notDraft");
    const problem = scheduleProblem(drop, new Date());
    if (problem) throw new Refused(problem);
    const editions = await tx.select({
      size: edition.size, units: sql<number>`count(${editionUnit.id})::int`, highest: sql<number>`coalesce(max(${editionUnit.number}), 0)::int`,
    }).from(edition).leftJoin(editionUnit, eq(editionUnit.editionId, edition.id)).where(eq(edition.dropId, drop.id)).groupBy(edition.id);
    if (!editions.length) throw new Refused("noEditions");
    // numbers are unique, so count = highest = size means exactly 1 to size
    if (editions.some((row) => row.units !== row.size || row.highest !== row.size)) throw new Refused("unitCount");
    await tx.update(dropRun).set({ state: "scheduled" }).where(eq(dropRun.id, drop.id));
    await audit({ adminId: actor.id, entity: "drop", entityId: drop.id, action: "schedule", oldValue: { state: "draft" }, newValue: { state: "scheduled" } }, tx);
  });
}

/** Rows from..to of a numbered run (06 §2). */
const addUnits = (tx: Tx, editionId: string, from: number, to: number) => tx.execute(sql`
  insert into ${editionUnit} (edition_id, number) select ${editionId}::uuid, n from generate_series(${from}::int, ${to}::int) as n`);

export async function addEdition(actor: Staff, number: number, variantId: string, terms: EditionTerms): Promise<Result> {
  const problem = editionProblem(terms);
  if (problem) return { ok: false, error: problem };
  return change(actor, async (tx) => {
    const drop = await lockDrop(tx, number);
    if (salesStarted(drop, new Date())) throw new Refused("locked");
    const [known] = await tx.select({ id: variant.id }).from(variant).where(eq(variant.id, variantId));
    if (!known) throw new Refused("gone");
    const [made] = await tx.insert(edition).values({ dropId: drop.id, variantId, ...terms }).onConflictDoNothing().returning({ id: edition.id });
    if (!made) throw new Refused("variantTaken");
    await addUnits(tx, made.id, 1, terms.size);
    await audit({ adminId: actor.id, entity: "edition", entityId: made.id, action: "create", newValue: { drop: number, variantId, ...terms } }, tx);
  });
}

/**
 * Size, price and cap, only before selling starts. FR-097 freezes the price from the public opening; this is
 * stricter, because holds begin at early access. [ASSUMPTION]
 * Numbers stay 1 to size: growing adds the next ones, shrinking removes the highest, and never one that is taken.
 */
export async function updateEdition(actor: Staff, editionId: string, terms: EditionTerms): Promise<Result> {
  const problem = editionProblem(terms);
  if (problem) return { ok: false, error: problem };
  return change(actor, async (tx) => {
    const [found] = await tx.select({ number: dropRun.number }).from(edition)
      .innerJoin(dropRun, eq(edition.dropId, dropRun.id)).where(eq(edition.id, editionId));
    if (!found) throw new Refused("gone");
    const drop = await lockDrop(tx, found.number);
    if (salesStarted(drop, new Date())) throw new Refused("locked");
    const [row] = await tx.select().from(edition).where(eq(edition.id, editionId));
    const before: EditionTerms = { size: row.size, priceVnd: row.priceVnd, perPersonCap: row.perPersonCap };
    if (before.size === terms.size && before.priceVnd === terms.priceVnd && before.perPersonCap === terms.perPersonCap) return;

    if (terms.size > before.size) await addUnits(tx, editionId, before.size + 1, terms.size);
    if (terms.size < before.size) {
      const above = and(eq(editionUnit.editionId, editionId), gt(editionUnit.number, terms.size));
      // free means what the live count means by it: available, or held by a hold that has run out
      await tx.delete(editionUnit).where(and(above,
        sql`(${editionUnit.status} = 'available' or (${editionUnit.status} = 'held' and ${editionUnit.heldUntil} <= now()))`));
      // asked after the delete, not before: a hold taken meanwhile leaves its row here, and everything is undone
      const [kept] = await tx.select({ id: editionUnit.id }).from(editionUnit).where(above).limit(1);
      if (kept) throw new Refused("unitsInUse");
    }
    await tx.update(edition).set(terms).where(eq(edition.id, editionId));
    await audit({ adminId: actor.id, entity: "edition", entityId: editionId, action: "update", oldValue: before, newValue: terms }, tx);
  });
}

export async function listDrops() {
  return db.select().from(dropRun).orderBy(desc(dropRun.number));
}

export async function findDrop(number: number) {
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, number));
  if (!drop) return null;
  const editions = await db.select({
    id: edition.id, variantId: variant.id, name: product.name, colour: variant.colour,
    size: edition.size, priceVnd: edition.priceVnd, perPersonCap: edition.perPersonCap,
    taken: sql<number>`count(${editionUnit.id}) filter (where ${editionUnit.status} in ('sold', 'retired') or (${editionUnit.status} = 'held' and ${editionUnit.heldUntil} > now()))::int`,
  }).from(edition)
    .innerJoin(variant, eq(edition.variantId, variant.id))
    .innerJoin(product, eq(variant.productId, product.id))
    .leftJoin(editionUnit, eq(editionUnit.editionId, edition.id))
    .where(eq(edition.dropId, drop.id))
    .groupBy(edition.id, variant.id, product.id)
    .orderBy(asc(product.sort), asc(variant.colour));
  return { ...drop, editions };
}

export async function allVariants() {
  return db.select({ id: variant.id, name: product.name, colour: variant.colour, listPriceVnd: variant.listPriceVnd }).from(variant)
    .innerJoin(product, eq(variant.productId, product.id)).orderBy(asc(product.sort), asc(variant.colour));
}
