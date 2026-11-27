// Orders and payments (FR-050 to FR-052, PRC-03). A provider adapter only has to do two things: send the buyer off
// with the transaction id from startPayment(), and give what the provider reports back to confirmPayment().
// Relative imports, so scripts/check-payments.ts can run this outside Next.
import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { account, address, customerOrder, dropRun, edition, editionUnit, hold, orderLine, payment, refund } from "../db/schema";
import { shippingEstimateVnd } from "./checkout-rules";
import type { OnlineMethod } from "./payment-rules";
import { base32 } from "./totp";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const CANCELLED_BY_BUYER = "cancelled_by_buyer";
const notRefunded = sql`not exists (select 1 from ${refund} r where r.payment_id = ${payment.id})`;

export type StartResult =
  | { ok: true; txn: string }
  | { ok: false; error: "noHold" | "noAddress" | "twoDrops" | "badKey" | "closed" };

const paying = (tx: Tx, accountId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`pay:${accountId}`}, 0))`);

/** Ends an unpaid order. Its lines stay, as a record, but stop claiming their units. */
async function cancelOrders(tx: Tx, orderIds: string[]) {
  if (!orderIds.length) return;
  const cancelled = await tx.update(customerOrder).set({ status: "cancelled" })
    .where(and(inArray(customerOrder.id, orderIds), eq(customerOrder.status, "pending"))).returning({ id: customerOrder.id });
  if (cancelled.length) {
    await tx.update(orderLine).set({ releasedAt: new Date() })
      .where(and(inArray(orderLine.orderId, cancelled.map((row) => row.id)), isNull(orderLine.releasedAt)));
  }
}

/**
 * Cancels this account's unpaid orders whose units it no longer holds. Done when orders are read, so nothing has to
 * sweep. A payment that still comes in for one is handled by confirmPayment().
 */
export async function expireStaleOrders(accountId: string) {
  await db.transaction(async (tx) => {
    await paying(tx, accountId);
    const stale = await tx.execute<{ id: string }>(sql`
      select distinct o.id from ${customerOrder} o
      join ${orderLine} l on l.order_id = o.id and l.released_at is null
      join ${editionUnit} u on u.id = l.edition_unit_id
      where o.account_id = ${accountId} and o.status = 'pending'
        -- only an online payment that was started and left: not cash on delivery, which waits without a hold
        and o.payment_method <> 'cod' and exists (select 1 from ${payment} p where p.order_id = o.id)
        and not exists (
        select 1 from ${hold} h where h.id = u.hold_id and h.account_id = o.account_id and h.status = 'active' and h.expires_at > now())`);
    await cancelOrders(tx, stale.rows.map((row) => row.id));
  });
}

/**
 * One payment attempt for everything this account is holding. `key` is made when the Pay button is drawn, so a double
 * click gets the same attempt back (NFR-016). Trying again after a failure reuses the order.
 */
export async function startPayment(accountId: string, method: OnlineMethod, key: string): Promise<StartResult> {
  return db.transaction(async (tx) => {
    await paying(tx, accountId);
    const [seen] = await tx.select({ txn: payment.providerTxnId, owner: customerOrder.accountId }).from(payment)
      .innerJoin(customerOrder, eq(payment.orderId, customerOrder.id)).where(eq(payment.idempotencyKey, key));
    if (seen) return seen.owner === accountId ? { ok: true as const, txn: seen.txn! } : { ok: false as const, error: "badKey" as const };

    const held = await tx.select({
      unitId: editionUnit.id, priceVnd: edition.priceVnd, dropId: edition.dropId,
      shut: sql<boolean>`${dropRun.state} = 'closed' or coalesce(${dropRun.closeAt} <= now(), false)`,
    }).from(hold)
      .innerJoin(editionUnit, eq(editionUnit.holdId, hold.id)).innerJoin(edition, eq(hold.editionId, edition.id))
      .innerJoin(dropRun, eq(edition.dropId, dropRun.id))
      .where(and(eq(hold.accountId, accountId), eq(hold.status, "active"), gt(hold.expiresAt, sql`now()`)))
      .orderBy(asc(editionUnit.id));
    if (!held.length) return { ok: false as const, error: "noHold" as const };
    if (held.some((row) => row.shut)) return { ok: false as const, error: "closed" as const };
    if (new Set(held.map((row) => row.dropId)).size > 1) return { ok: false as const, error: "twoDrops" as const }; // BRU-003
    const [to] = await tx.select().from(address).where(and(eq(address.accountId, accountId), eq(address.isDefault, true)));
    if (!to) return { ok: false as const, error: "noAddress" as const };

    const subtotalVnd = held.reduce((sum, row) => sum + row.priceVnd, 0);
    const shippingVnd = shippingEstimateVnd(to.province);
    const totals = {
      paymentMethod: method, subtotalVnd, shippingVnd, totalVnd: subtotalVnd + shippingVnd,
      // a copy: editing the address book later must not rewrite where this order went
      shipTo: { recipient: to.recipient, receiverPhone: to.receiverPhone, province: to.province, ward: to.ward, street: to.street },
    };

    const open = await tx.select({ id: customerOrder.id, unitId: orderLine.editionUnitId }).from(customerOrder)
      .innerJoin(orderLine, and(eq(orderLine.orderId, customerOrder.id), isNull(orderLine.releasedAt)))
      .where(and(eq(customerOrder.accountId, accountId), eq(customerOrder.status, "pending")));
    const wanted = held.map((row) => row.unitId).join();
    const same = open.find((row) => open.filter((other) => other.id === row.id).map((other) => other.unitId).sort().join() === wanted)?.id;
    await cancelOrders(tx, [...new Set(open.map((row) => row.id))].filter((id) => id !== same));
    // I hold these units now, so anyone else's unpaid order still naming one ran out
    const theirs = await tx.select({ id: orderLine.orderId }).from(orderLine)
      .where(and(inArray(orderLine.editionUnitId, held.map((row) => row.unitId)), isNull(orderLine.releasedAt), same ? ne(orderLine.orderId, same) : undefined));
    await cancelOrders(tx, theirs.map((row) => row.id));

    let orderId = same;
    if (orderId) {
      await tx.update(customerOrder).set(totals).where(eq(customerOrder.id, orderId));
    } else {
      const [made] = await tx.insert(customerOrder)
        .values({ ...totals, accountId, orderNo: `ST-${base32(randomBytes(5))}`, status: "pending" }).returning({ id: customerOrder.id });
      orderId = made.id;
      await tx.insert(orderLine).values(held.map((row) => ({ orderId: made.id, editionUnitId: row.unitId, priceVnd: row.priceVnd })));
    }
    const txn = randomUUID();
    await tx.insert(payment)
      .values({ orderId, provider: method, providerTxnId: txn, idempotencyKey: key, amountVnd: totals.totalVnd, status: "pending" });
    return { ok: true as const, txn };
  });
}

export type Reported = "success" | "failed" | "cancelled";
export type Confirmed =
  /** `first` is true for the one call that changed it, so the order email is sent once. */
  | { result: "paid"; orderId: string; first: boolean }
  | { result: "refunded" | "failed" | "cancelled"; orderId: string }
  | { result: "unknown" | "mismatch" };

/**
 * What the provider says happened. Safe to call any number of times. The caller has already proved the report is
 * the provider's (a signature, for a real one). A success is final and counts even after a failure or a cancel,
 * because money has moved: either the buyer gets their numbers or a refund is recorded.
 */
export async function confirmPayment(txn: string, amountVnd: number, reported: Reported): Promise<Confirmed> {
  return db.transaction(async (tx) => {
    const [attempt] = await tx.select().from(payment).where(eq(payment.providerTxnId, txn)).for("update");
    if (!attempt) return { result: "unknown" as const };
    if (attempt.amountVnd !== amountVnd) return { result: "mismatch" as const };
    const [order] = await tx.select().from(customerOrder).where(eq(customerOrder.id, attempt.orderId));
    const orderId = order.id;

    if (attempt.status === "succeeded") {
      const [back] = await tx.select({ id: refund.id }).from(refund).where(eq(refund.paymentId, attempt.id));
      return back ? { result: "refunded" as const, orderId } : { result: "paid" as const, orderId, first: false };
    }
    if (reported !== "success") {
      await tx.update(payment).set({ status: reported }).where(eq(payment.id, attempt.id));
      return { result: reported, orderId };
    }

    await paying(tx, order.accountId);
    await tx.update(payment).set({ status: "succeeded" }).where(eq(payment.id, attempt.id));
    const owe = (reason: string) => tx.insert(refund)
      .values({ paymentId: attempt.id, amountVnd: attempt.amountVnd, method: "original", reason });
    // read again under the account's lock
    const [now] = await tx.select({ status: customerOrder.status, totalVnd: customerOrder.totalVnd }).from(customerOrder)
      .where(eq(customerOrder.id, orderId)).for("update");
    // an order cancelled after it was paid for has been dealt with too; one cancelled unpaid has not
    const [paidBefore] = await tx.select({ id: payment.id }).from(payment)
      .where(and(eq(payment.orderId, orderId), eq(payment.status, "succeeded"), ne(payment.id, attempt.id), notRefunded));
    const [settled] = await tx.select({ id: refund.id }).from(refund).innerJoin(payment, eq(refund.paymentId, payment.id))
      .where(and(eq(payment.orderId, orderId), eq(refund.reason, CANCELLED_BY_BUYER)));
    if (paidBefore || settled || (now.status !== "pending" && now.status !== "cancelled")) {
      await owe("duplicate"); // a second payment for an order already dealt with; the order stays as it is
      return { result: "refunded" as const, orderId };
    }
    // the order was changed by a later try (another address, another shipping fee): this money doesn't match it
    if (attempt.amountVnd !== now.totalVnd) {
      await owe("amount_changed");
      return { result: "refunded" as const, orderId };
    }
    // shared lock: deleting the account waits for this, or this waits and sees it deleted
    const [buyer] = await tx.select({ email: account.email }).from(account).where(eq(account.id, order.accountId)).for("share");

    const lines = await tx.select({ id: orderLine.id, unitId: orderLine.editionUnitId, editionId: editionUnit.editionId, cap: edition.perPersonCap })
      .from(orderLine).innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id))
      .innerJoin(edition, eq(editionUnit.editionId, edition.id)).where(eq(orderLine.orderId, orderId));
    const [shut] = await tx.select({ id: dropRun.id }).from(dropRun).innerJoin(edition, eq(edition.dropId, dropRun.id))
      .where(and(inArray(edition.id, lines.map((line) => line.editionId)), eq(dropRun.state, "closed")));
    const editions = [...new Set(lines.map((line) => line.editionId))].sort();
    // the same lock holdUnit() takes, so a new hold can't slip past the cap while this is deciding
    for (const id of editions) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hold:${order.accountId}:${id}`}, 0))`);
    // units before holds, the order holdUnit() takes them in
    const units = await tx.execute<{ id: string; status: string; hold_id: string | null; lapsed: boolean }>(sql`
      select id, status, hold_id, coalesce(held_until <= now(), false) as lapsed from ${editionUnit}
      where ${inArray(editionUnit.id, lines.map((line) => line.unitId))} order by id for update`);
    const mine = new Set((await tx.select({ id: hold.id }).from(hold).where(eq(hold.accountId, order.accountId))).map((row) => row.id));
    const free = units.rows.every((unit) => unit.status === "available"
      || (unit.status === "held" && (unit.lapsed || (unit.hold_id !== null && mine.has(unit.hold_id)))));

    let reason = buyer.email.endsWith("@deleted.invalid") ? "account_deleted" : shut ? "drop_closed" : free ? null : "unit_taken";
    const bought = async (editionId: string) => {
      const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderLine)
        .innerJoin(customerOrder, eq(orderLine.orderId, customerOrder.id))
        .innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id))
        .where(and(eq(customerOrder.accountId, order.accountId), eq(editionUnit.editionId, editionId), inArray(editionUnit.status, ["sold", "retired"]), isNull(orderLine.releasedAt)));
      return row.n;
    };
    for (const id of editions) {
      const asked = lines.filter((line) => line.editionId === id);
      if (!reason && (await bought(id)) + asked.length > asked[0].cap) reason = "cap";
    }

    if (reason) {
      await owe(reason);
      await tx.update(customerOrder).set({ status: "refunded" }).where(eq(customerOrder.id, orderId));
      await tx.update(orderLine).set({ releasedAt: new Date() }).where(and(eq(orderLine.orderId, orderId), isNull(orderLine.releasedAt)));
      return { result: "refunded" as const, orderId };
    }

    const unitIds = lines.map((line) => line.unitId);
    // another unpaid order may still name a unit whose hold ran out
    const rivals = await tx.select({ id: orderLine.orderId }).from(orderLine)
      .where(and(inArray(orderLine.editionUnitId, unitIds), isNull(orderLine.releasedAt), ne(orderLine.orderId, orderId)));
    await cancelOrders(tx, rivals.map((row) => row.id));
    for (const unit of units.rows) {
      if (!unit.hold_id) continue;
      await tx.update(hold).set({ status: mine.has(unit.hold_id) ? "converted" : "expired" })
        .where(and(eq(hold.id, unit.hold_id), eq(hold.status, "active")));
    }
    await tx.update(editionUnit).set({ status: "sold", holdId: null, heldUntil: null }).where(inArray(editionUnit.id, unitIds));
    await tx.update(orderLine).set({ releasedAt: null }).where(eq(orderLine.orderId, orderId));
    await tx.update(customerOrder).set({ status: "paid", paymentMethod: attempt.provider }).where(eq(customerOrder.id, orderId));

    // at the cap now, so a second number still held for this person goes back on sale
    for (const id of editions) {
      if ((await bought(id)) < lines.find((line) => line.editionId === id)!.cap) continue;
      const spare = await tx.update(hold).set({ status: "released" })
        .where(and(eq(hold.accountId, order.accountId), eq(hold.editionId, id), eq(hold.status, "active"))).returning({ id: hold.id });
      if (spare.length) {
        await tx.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null })
          .where(and(inArray(editionUnit.holdId, spare.map((row) => row.id)), eq(editionUnit.status, "held")));
      }
    }
    return { result: "paid" as const, orderId, first: true };
  });
}

/** Statuses from which the buyer can still cancel: nothing has shipped (FR-066). */
export const CANCELLABLE = ["paid", "confirmed", "packing"] as const;

/**
 * Cancelling a paid order: the money is recorded as due back by the way it came (nothing for cash on delivery), and
 * the numbers are retired. Their lines keep the claim, so they still count toward the cap: otherwise buying and
 * cancelling in a loop would retire a whole run. [ASSUMPTION] whether a cancelled number goes back on sale is
 * undecided; retiring it is the choice that can still be reversed.
 */
export async function cancelOrder(accountId: string, orderNo: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await paying(tx, accountId);
    const [order] = await tx.select().from(customerOrder)
      .where(and(eq(customerOrder.accountId, accountId), eq(customerOrder.orderNo, orderNo))).for("update");
    if (!order || !(CANCELLABLE as readonly string[]).includes(order.status)) return false;
    const [money] = await tx.select().from(payment)
      .where(and(eq(payment.orderId, order.id), eq(payment.status, "succeeded"), notRefunded));
    if (money && money.provider !== "cod") {
      await tx.insert(refund).values({ paymentId: money.id, amountVnd: money.amountVnd, method: "original", reason: CANCELLED_BY_BUYER });
    }
    const units = await tx.select({ id: orderLine.editionUnitId }).from(orderLine)
      .where(and(eq(orderLine.orderId, order.id), isNull(orderLine.releasedAt)));
    if (units.length) {
      await tx.update(editionUnit).set({ status: "retired", holdId: null, heldUntil: null }).where(inArray(editionUnit.id, units.map((row) => row.id)));
    }
    await tx.update(customerOrder).set({ status: "cancelled" }).where(eq(customerOrder.id, order.id));
    return true;
  });
}

/** A payment of this account's, for the pages between Pay and the result. */
export async function findPayment(accountId: string, txn: string) {
  const [row] = await db.select({
    status: payment.status, amountVnd: payment.amountVnd, provider: payment.provider,
    orderNo: customerOrder.orderNo, orderStatus: customerOrder.status,
  }).from(payment).innerJoin(customerOrder, eq(payment.orderId, customerOrder.id))
    .where(and(eq(payment.providerTxnId, txn), eq(customerOrder.accountId, accountId)));
  return row ?? null;
}
