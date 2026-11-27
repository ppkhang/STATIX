// A2: one drop at a glance (FR-089), read only. The role check is here, with the numbers.
// Relative imports, so scripts/check-payments.ts can run this outside Next.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { customerOrder, dropRun, edition, editionUnit, hold, orderLine, payment, product, refund, variant, waitlistEntry } from "../db/schema";
import { can, type Staff } from "./staff";

/** Money received and not owed back, as far as an order's status says. */
const PAID = ["paid", "confirmed", "packing", "shipped", "delivered", "completed"] as const;

export async function dashboard(actor: Staff, number: number) {
  if (!can(actor.role, "dashboard")) return null;
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, number));
  if (!drop) return null;

  const count = (condition: ReturnType<typeof sql>) => sql<number>`count(${editionUnit.id}) filter (where ${condition})::int`;
  const editions = await db.select({
    id: edition.id, name: product.name, colour: variant.colour, size: edition.size,
    left: count(sql`${editionUnit.status} = 'available' or (${editionUnit.status} = 'held' and ${editionUnit.heldUntil} <= now())`),
    held: count(sql`${editionUnit.status} = 'held' and ${editionUnit.heldUntil} > now()`),
    sold: count(sql`${editionUnit.status} = 'sold'`),
    retired: count(sql`${editionUnit.status} = 'retired'`),
  }).from(edition)
    .innerJoin(variant, eq(edition.variantId, variant.id)).innerJoin(product, eq(variant.productId, product.id))
    .leftJoin(editionUnit, eq(editionUnit.editionId, edition.id))
    .where(eq(edition.dropId, drop.id)).groupBy(edition.id, variant.id, product.id)
    .orderBy(asc(product.sort), asc(variant.colour));

  // "invited" is a confirmed person who has been sent their invite
  const [waitlist] = await db.select({
    confirmed: sql<number>`count(*) filter (where ${waitlistEntry.status} in ('confirmed', 'invited'))::int`,
    pending: sql<number>`count(*) filter (where ${waitlistEntry.status} = 'pending')::int`,
  }).from(waitlistEntry).where(eq(waitlistEntry.dropId, drop.id));

  const runs = db.select({ id: edition.id }).from(edition).where(eq(edition.dropId, drop.id));
  const [holds] = await db.select({
    open: sql<number>`count(*) filter (where ${hold.status} = 'active' and ${hold.expiresAt} > now())::int`,
    people: sql<number>`count(distinct ${hold.accountId})::int`,
  }).from(hold).where(inArray(hold.editionId, runs));

  // an order belongs to one drop (BRU-003), so picking orders by their lines counts each once
  const ofDrop = inArray(customerOrder.id, db.select({ id: orderLine.orderId }).from(orderLine)
    .innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id)).where(inArray(editionUnit.editionId, runs)));
  const [paid] = await db.select({
    orders: sql<number>`count(*)::int`,
    people: sql<number>`count(distinct ${customerOrder.accountId})::int`,
    totalVnd: sql<string>`coalesce(sum(${customerOrder.totalVnd}), 0)`,
  }).from(customerOrder).where(and(ofDrop, inArray(customerOrder.status, [...PAID])));
  const [owed] = await db.select({ totalVnd: sql<string>`coalesce(sum(${refund.amountVnd}), 0)` }).from(refund)
    .innerJoin(payment, eq(refund.paymentId, payment.id)).innerJoin(customerOrder, eq(payment.orderId, customerOrder.id))
    .where(and(ofDrop, eq(refund.status, "pending")));

  return {
    drop, editions, waitlist, holds,
    // sums come back as text: they can outgrow a 32-bit integer
    paid: { orders: paid.orders, people: paid.people, totalVnd: Number(paid.totalVnd) },
    owedVnd: Number(owed.totalVnd),
  };
}
