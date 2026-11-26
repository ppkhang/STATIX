// Holds on numbered units (FR-011 to FR-015, data model §2). Overselling a numbered run is the one bug this store
// can't have: units are pre-created rows, and a hold locks the row it takes.
// Relative imports, so scripts/check-holds.ts can run this outside Next.
import { and, asc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { account, customerOrder, dropRun, edition, editionUnit, hold, invite, orderLine, product, setting, tier, variant, waitlistEntry } from "../db/schema";
import { dropStatus } from "./drop-status";
import { refusal, type Refusal } from "./purchase-rules";

export type HoldResult =
  | { ok: true; holdId: string; number: number; expiresAt: Date; already: boolean }
  | { ok: false; error: Refusal | "cap" | "unknown" };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MAX_EXTENSIONS = 1; // BRU-005: one extension

async function minutes(tx: Tx | typeof db, key: "hold_minutes" | "hold_extension_minutes"): Promise<number> {
  const [row] = await tx.select({ value: setting.value }).from(setting).where(eq(setting.key, key));
  const value = Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

/** Takes the lowest free number of an edition for this account. Asking twice gives back the same hold. */
export async function holdUnit(accountId: string, editionId: string): Promise<HoldResult> {
  return db.transaction(async (tx) => {
    // one at a time per person and edition, so two clicks can't both pass the cap
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hold:${accountId}:${editionId}`}, 0))`);

    const [target] = await tx.select({ edition, drop: dropRun }).from(edition)
      .innerJoin(dropRun, eq(edition.dropId, dropRun.id)).where(eq(edition.id, editionId));
    const [buyer] = await tx.select({ emailVerified: account.emailVerified, phoneVerified: account.phoneVerified, tier: tier.code })
      .from(account).innerJoin(tier, eq(account.tierId, tier.id)).where(eq(account.id, accountId));
    // left = 1 here: "sold out" is decided below by whether a unit can actually be taken
    const status = target && dropStatus(target.drop, new Date(), 1);
    if (!target || !buyer || !status) return { ok: false, error: "unknown" } as const;

    // a hold of mine that has run out is ended now: its "active" row would block a new one
    const stale = await tx.update(hold).set({ status: "expired" })
      .where(and(eq(hold.accountId, accountId), eq(hold.editionId, editionId), eq(hold.status, "active"), sql`${hold.expiresAt} <= now()`))
      .returning({ id: hold.id });
    for (const { id } of stale) await freeUnit(tx, id);

    // already holding one: hand it back, whatever has happened to the drop since
    const [mine] = await tx.select({ id: hold.id, expiresAt: hold.expiresAt, number: editionUnit.number }).from(hold)
      .innerJoin(editionUnit, eq(editionUnit.holdId, hold.id))
      .where(and(eq(hold.accountId, accountId), eq(hold.editionId, editionId), eq(hold.status, "active")));
    if (mine) return { ok: true, holdId: mine.id, number: mine.number, expiresAt: mine.expiresAt, already: true } as const;

    const [accepted] = await tx.select({ id: invite.id }).from(invite)
      .innerJoin(waitlistEntry, eq(invite.entryId, waitlistEntry.id))
      .where(and(eq(invite.accountId, accountId), isNotNull(invite.usedAt), eq(waitlistEntry.dropId, target.drop.id))).limit(1);
    const no = refusal(status.state, { ...buyer, invited: Boolean(accepted) });
    if (no) return { ok: false, error: no } as const;

    // units already bought count toward the cap (FR-015)
    const [{ bought }] = await tx.select({ bought: sql<number>`count(*)::int` }).from(orderLine)
      .innerJoin(customerOrder, eq(orderLine.orderId, customerOrder.id))
      .innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id))
      .where(and(eq(customerOrder.accountId, accountId), eq(editionUnit.editionId, editionId), eq(editionUnit.status, "sold")));
    if (bought >= target.edition.perPersonCap) return { ok: false, error: "cap" } as const;

    // the lowest number that is free, or whose hold has run out; a row someone else is taking is skipped
    const picked = await tx.execute<{ id: string; previous: string | null }>(sql`
      select id, hold_id as previous from ${editionUnit}
      where edition_id = ${editionId} and (status = 'available' or (status = 'held' and held_until <= now()))
      order by number limit 1 for update skip locked`);
    const unit = picked.rows[0];
    if (!unit) return { ok: false, error: "soldOut" } as const;
    if (unit.previous) {
      await tx.update(hold).set({ status: "expired" }).where(and(eq(hold.id, unit.previous), eq(hold.status, "active")));
    }

    const lasts = await minutes(tx, "hold_minutes");
    const [made] = await tx.insert(hold)
      .values({ accountId, editionId, expiresAt: sql`now() + make_interval(mins => ${lasts})` })
      .returning({ id: hold.id, expiresAt: hold.expiresAt });
    const [taken] = await tx.update(editionUnit).set({ status: "held", holdId: made.id, heldUntil: made.expiresAt })
      .where(eq(editionUnit.id, unit.id)).returning({ number: editionUnit.number });
    return { ok: true, holdId: made.id, number: taken.number, expiresAt: made.expiresAt, already: false } as const;
  });
}

const freeUnit = (tx: Tx, holdId: string) => tx.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null })
  .where(and(eq(editionUnit.holdId, holdId), eq(editionUnit.status, "held")));

/** Gives the unit back. Only the holder can. */
export async function releaseHold(accountId: string, holdId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [mine] = await tx.update(hold).set({ status: "released" })
      .where(and(eq(hold.id, holdId), eq(hold.accountId, accountId), eq(hold.status, "active"))).returning({ id: hold.id });
    if (!mine) return false;
    await freeUnit(tx, mine.id);
    return true;
  });
}

/** One extension, only while the hold is still running. Null if it can't be extended. */
export async function extendHold(accountId: string, holdId: string): Promise<Date | null> {
  return db.transaction(async (tx) => {
    const more = await minutes(tx, "hold_extension_minutes");
    const [longer] = await tx.update(hold)
      .set({ expiresAt: sql`${hold.expiresAt} + make_interval(mins => ${more})`, extensions: sql`${hold.extensions} + 1` })
      .where(and(eq(hold.id, holdId), eq(hold.accountId, accountId), eq(hold.status, "active"),
        sql`${hold.expiresAt} > now()`, sql`${hold.extensions} < ${MAX_EXTENSIONS}`))
      .returning({ expiresAt: hold.expiresAt });
    if (!longer) return null;
    await tx.update(editionUnit).set({ heldUntil: longer.expiresAt }).where(eq(editionUnit.holdId, holdId));
    return longer.expiresAt;
  });
}

/** The holds this account has running, for checkout. */
export async function activeHolds(accountId: string) {
  return db.select({
    id: hold.id, expiresAt: hold.expiresAt, extensions: hold.extensions, editionId: edition.id, size: edition.size,
    priceVnd: edition.priceVnd, number: editionUnit.number, name: product.name, slug: product.slug, colour: variant.colour,
    drop: dropRun.name, dropNumber: dropRun.number,
  }).from(hold)
    .innerJoin(editionUnit, eq(editionUnit.holdId, hold.id))
    .innerJoin(edition, eq(hold.editionId, edition.id))
    .innerJoin(dropRun, eq(edition.dropId, dropRun.id))
    .innerJoin(variant, eq(edition.variantId, variant.id))
    .innerJoin(product, eq(variant.productId, product.id))
    .where(and(eq(hold.accountId, accountId), eq(hold.status, "active"), gt(hold.expiresAt, sql`now()`)))
    .orderBy(asc(product.sort));
}
