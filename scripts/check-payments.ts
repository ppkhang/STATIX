// Proves paying can't oversell a numbered run, charge twice for one click, or lose money, against a real Postgres
// (CI has none). Run: npm run check:payments
// Makes its own drop (number 900_997: a later drop, so never the current one) and test accounts, and removes them after.
// Refuses to run against a database that isn't on this machine.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { db } from "../src/db";
import { account, address, customerOrder, dropRun, edition, editionUnit, hold, orderLine, payment, refund, tier, variant } from "../src/db/schema";
import { deleteAccount } from "../src/lib/account-delete";
import { dashboard } from "../src/lib/admin-dashboard";
import { searchOrders, staffOrder } from "../src/lib/admin-orders";
import { findOrder, listOrders } from "../src/lib/orders";
import { holdUnit, releaseHold } from "../src/lib/holds";
import { cancelOrder, confirmPayment, expireStaleOrders, findPayment, startPayment, type Confirmed } from "../src/lib/payments";

const TEST_DROP = 900_997;
const UNITS = 5;
const BUYERS = 30;
const MAIL = "@payments.statix.test";
const hour = 3_600_000;
const gone: string[] = []; // anonymised accounts no longer match MAIL

async function cleanUp() {
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, TEST_DROP));
  const editions = drop ? (await db.select({ id: edition.id }).from(edition).where(eq(edition.dropId, drop.id))).map((e) => e.id) : [];
  const units = editions.length ? (await db.select({ id: editionUnit.id }).from(editionUnit).where(inArray(editionUnit.editionId, editions))).map((u) => u.id) : [];
  const orders = units.length ? [...new Set((await db.select({ id: orderLine.orderId }).from(orderLine).where(inArray(orderLine.editionUnitId, units))).map((l) => l.id))] : [];
  const owners = orders.length ? (await db.select({ id: customerOrder.accountId }).from(customerOrder).where(inArray(customerOrder.id, orders))).map((o) => o.id) : [];
  const people = [...new Set([...gone, ...owners, ...(await db.select({ id: account.id }).from(account).where(like(account.email, `%${MAIL}`))).map((a) => a.id)])];
  if (orders.length) {
    const paid = (await db.select({ id: payment.id }).from(payment).where(inArray(payment.orderId, orders))).map((p) => p.id);
    if (paid.length) await db.delete(refund).where(inArray(refund.paymentId, paid));
    await db.delete(payment).where(inArray(payment.orderId, orders));
    await db.delete(orderLine).where(inArray(orderLine.orderId, orders));
    await db.delete(customerOrder).where(inArray(customerOrder.id, orders));
  }
  if (editions.length) {
    await db.delete(editionUnit).where(inArray(editionUnit.editionId, editions));
    await db.delete(hold).where(inArray(hold.editionId, editions));
    await db.delete(edition).where(inArray(edition.id, editions));
  }
  if (drop) await db.delete(dropRun).where(eq(dropRun.id, drop.id));
  if (people.length) await db.delete(account).where(inArray(account.id, people));
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Refusing to run against ${host}: this creates and deletes rows`);
  await cleanUp();
  const ok = (message: string) => console.log(`  ok  ${message}`);

  const [drop] = await db.insert(dropRun).values({
    number: TEST_DROP, name: "Payment check", state: "scheduled",
    earlyAccessAt: new Date(Date.now() - 2 * hour), publicAt: new Date(Date.now() - hour),
  }).returning();
  const [anyVariant] = await db.select().from(variant).limit(1);
  const [run] = await db.insert(edition).values({ dropId: drop.id, variantId: anyVariant.id, size: UNITS, priceVnd: 1000, perPersonCap: 1 }).returning();
  await db.insert(editionUnit).values(Array.from({ length: UNITS }, (_, i) => ({ editionId: run.id, number: i + 1 })));
  const [member] = await db.select().from(tier).where(eq(tier.code, "member"));
  const buyers = (await db.insert(account).values(Array.from({ length: BUYERS }, (_, i) => ({
    email: `buyer${i}${MAIL}`, emailVerified: true, phone: `+8400008${String(i).padStart(4, "0")}`, phoneVerified: true, tierId: member.id,
  }))).returning({ id: account.id })).map((a) => a.id);
  await db.insert(address).values(buyers.map((accountId) => ({
    accountId, recipient: "Test", province: "Hà Nội", ward: "Ward 1", street: "1 Test Street", receiverPhone: "+84912345678", isDefault: true,
  })));

  const reset = async () => {
    const units = (await db.select({ id: editionUnit.id }).from(editionUnit).where(eq(editionUnit.editionId, run.id))).map((u) => u.id);
    const orders = [...new Set((await db.select({ id: orderLine.orderId }).from(orderLine).where(inArray(orderLine.editionUnitId, units))).map((l) => l.id))];
    if (orders.length) {
      const paid = (await db.select({ id: payment.id }).from(payment).where(inArray(payment.orderId, orders))).map((p) => p.id);
      if (paid.length) await db.delete(refund).where(inArray(refund.paymentId, paid));
      await db.delete(payment).where(inArray(payment.orderId, orders));
      await db.delete(orderLine).where(inArray(orderLine.orderId, orders));
      await db.delete(customerOrder).where(inArray(customerOrder.id, orders));
    }
    await db.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null }).where(eq(editionUnit.editionId, run.id));
    await db.delete(hold).where(eq(hold.editionId, run.id));
  };
  const take = async (who: string) => {
    const got = await holdUnit(who, run.id);
    assert.ok(got.ok, JSON.stringify(got));
    return got;
  };
  const start = async (who: string, key: string = randomUUID()) => {
    const started = await startPayment(who, "momo", key);
    assert.ok(started.ok, JSON.stringify(started));
    return started.txn;
  };
  const total = async (who: string, txn: string) => (await findPayment(who, txn))!.amountVnd;
  const confirm = async (who: string, txn: string, reported: "success" | "failed" | "cancelled" = "success") => confirmPayment(txn, await total(who, txn), reported);
  const lapse = async (holdId: string) => {
    await db.execute(sql`update hold set expires_at = now() - interval '1 second' where id = ${holdId}`);
    await db.execute(sql`update edition_unit set held_until = now() - interval '1 second' where hold_id = ${holdId}`);
  };
  const unit = async (number: number) => (await db.select().from(editionUnit).where(and(eq(editionUnit.editionId, run.id), eq(editionUnit.number, number))))[0];
  const ordersOf = (who: string) => db.select().from(customerOrder).where(eq(customerOrder.accountId, who));
  const refundsOf = (who: string) => db.select({ reason: refund.reason, amount: refund.amountVnd }).from(refund)
    .innerJoin(payment, eq(refund.paymentId, payment.id)).innerJoin(customerOrder, eq(payment.orderId, customerOrder.id)).where(eq(customerOrder.accountId, who));
  const [a, b, c] = buyers;

  // nothing to pay for
  assert.deepEqual(await startPayment(a, "momo", randomUUID()), { ok: false, error: "noHold" });
  await take(a);
  await db.update(address).set({ isDefault: false }).where(eq(address.accountId, a));
  assert.deepEqual(await startPayment(a, "momo", randomUUID()), { ok: false, error: "noAddress" });
  await db.update(address).set({ isDefault: true }).where(eq(address.accountId, a));

  const key = randomUUID();
  const clicks = await Promise.all(Array.from({ length: 10 }, () => start(a, key)));
  assert.equal(new Set(clicks).size, 1);
  assert.equal((await ordersOf(a)).length, 1);
  assert.equal(await total(a, clicks[0]), 1000 + 40_000);
  assert.deepEqual(await startPayment(b, "momo", key), { ok: false, error: "badKey" });
  assert.equal(await findPayment(b, clicks[0]), null);
  ok("Pay pressed 10 times at once makes one order and one payment; someone else's key or payment opens nothing");

  assert.equal((await confirmPayment(clicks[0], 1, "success")).result, "mismatch");
  assert.equal((await confirmPayment("made-up", 1000, "success")).result, "unknown");
  assert.equal((await unit(1)).status, "held");
  assert.equal((await confirm(a, clicks[0], "failed")).result, "failed");
  assert.equal((await ordersOf(a))[0].status, "pending");
  assert.equal((await unit(1)).status, "held");
  const retry = await start(a);
  assert.notEqual(retry, clicks[0]);
  assert.equal((await ordersOf(a)).length, 1);
  ok("a wrong amount changes nothing; after a decline the hold stays and trying again reuses the order");

  const reports = await Promise.all(Array.from({ length: 10 }, () => confirm(a, retry)));
  assert.ok(reports.every((r) => r.result === "paid"));
  assert.equal(reports.filter((r) => r.result === "paid" && r.first).length, 1);
  assert.equal((await unit(1)).status, "sold");
  assert.equal((await ordersOf(a))[0].status, "paid");
  assert.equal((await db.select().from(hold).where(eq(hold.accountId, a)))[0].status, "converted");
  assert.equal((await refundsOf(a)).length, 0);
  assert.deepEqual(await holdUnit(a, run.id), { ok: false, error: "cap" });
  assert.equal((await confirm(a, retry, "failed")).result, "paid", "a late failure can't undo a success");
  ok("the same success reported 10 times at once sells the unit once, and only one call sends the email");

  // the first attempt, declined earlier, now reports money taken as well
  assert.equal((await confirm(a, clicks[0])).result, "refunded");
  assert.equal((await confirm(a, clicks[0])).result, "refunded");
  assert.deepEqual(await refundsOf(a), [{ reason: "duplicate", amount: 41_000 }]);
  assert.equal((await ordersOf(a))[0].status, "paid");
  ok("a second charge for a paid order records one refund and leaves the order alone");

  await reset();
  await take(a);
  const cheap = await start(a); // Hà Nội, 40,000 shipping
  await db.update(address).set({ province: "Đà Nẵng" }).where(eq(address.accountId, a));
  const dear = await start(a); // 50,000
  assert.equal((await confirm(a, cheap)).result, "refunded");
  assert.equal((await ordersOf(a))[0].status, "pending");
  assert.equal((await unit(1)).status, "held");
  assert.equal((await confirm(a, dear)).result, "paid");
  assert.deepEqual(await refundsOf(a), [{ reason: "amount_changed", amount: 41_000 }]);
  assert.equal((await ordersOf(a))[0].totalVnd, 51_000);
  await db.update(address).set({ province: "Hà Nội" }).where(eq(address.accountId, a));
  ok("an earlier try for a different total is refunded; only the try matching the order pays it");

  // cancelling what was just paid
  const [paidOrder] = await ordersOf(a);
  assert.equal(await cancelOrder(b, paidOrder.orderNo), false, "someone else's");
  const cancels = await Promise.all(Array.from({ length: 8 }, () => cancelOrder(a, paidOrder.orderNo)));
  assert.equal(cancels.filter(Boolean).length, 1);
  assert.equal((await ordersOf(a))[0].status, "cancelled");
  assert.equal((await listOrders(a)).length, 1, "cancelled after paying stays listed");
  assert.equal((await unit(1)).status, "retired");
  assert.deepEqual((await refundsOf(a)).map((r) => [r.reason, r.amount]).sort(), [["amount_changed", 41_000], ["cancelled_by_buyer", 51_000]]);
  assert.deepEqual(await holdUnit(a, run.id), { ok: false, error: "cap" });
  assert.equal(await deleteAccount(a), "openDrop");
  assert.equal((await confirm(a, dear)).result, "refunded", "a replay says the money is due back");
  assert.equal((await refundsOf(a)).length, 2, "and records nothing new");
  assert.equal((await ordersOf(a))[0].status, "cancelled");
  assert.equal((await take(b)).number, 2, "the retired number isn't sold again");
  await db.update(customerOrder).set({ status: "shipped" }).where(eq(customerOrder.id, paidOrder.id));
  assert.equal(await cancelOrder(a, paidOrder.orderNo), false, "not after shipping");
  ok("cancelling 8 times at once refunds once, retires the number, keeps the cap, and stops at shipping");

  // a declined try that reports success after the order was cancelled must not bring it back
  await reset();
  await take(a);
  const declined = await start(a);
  await confirm(a, declined, "failed");
  await confirm(a, await start(a));
  await cancelOrder(a, (await ordersOf(a))[0].orderNo);
  assert.equal((await confirm(a, declined)).result, "refunded");
  assert.equal((await ordersOf(a))[0].status, "cancelled");
  assert.equal((await refundsOf(a)).length, 2);
  ok("a second charge landing after a cancel is refunded and the order stays cancelled");

  const ops = { id: a, email: "ops", role: "ops" as const };

  // the dashboard, from a known state: one sold and paid, one held, one cancelled after paying
  await reset();
  await take(a);
  await confirm(a, await start(a));
  await take(b);
  await take(c);
  await confirm(c, await start(c));
  await cancelOrder(c, (await ordersOf(c))[0].orderNo);
  for (const role of ["fulfilment", "support", "community"] as const) assert.equal(await dashboard({ ...ops, role }, TEST_DROP), null);
  const board = (await dashboard(ops, TEST_DROP))!;
  const [counts] = board.editions;
  assert.deepEqual([counts.size, counts.left, counts.held, counts.sold, counts.retired], [5, 2, 1, 1, 1]);
  assert.deepEqual([board.holds.open, board.holds.people, board.paid.orders, board.paid.people], [1, 3, 1, 1]);
  assert.deepEqual([board.paid.totalVnd, board.owedVnd], [41_000, 41_000]);
  assert.deepEqual(board.waitlist, { confirmed: 0, pending: 0 });
  ok("the dashboard counts units, holds, paid orders and refunds owed, for Owner and Ops only");

  // back to the state the staff search below expects
  await reset();
  await take(a);
  const again = await start(a);
  await confirm(a, again, "failed");
  await confirm(a, await start(a));
  await cancelOrder(a, (await ordersOf(a))[0].orderNo);
  await confirm(a, again);
  for (const role of ["support", "community"] as const) {
    assert.equal(await searchOrders({ ...ops, role }), null);
    assert.equal(await staffOrder({ ...ops, role }, (await ordersOf(a))[0].orderNo), null);
  }
  assert.ok(await searchOrders({ ...ops, role: "owner" }));
  const [target] = await ordersOf(a);
  const numbers = async (filter: Parameters<typeof searchOrders>[1]) => (await searchOrders(ops, filter))!.map((row) => row.orderNo);
  for (const q of [target.orderNo.toLowerCase(), `buyer0${MAIL}`, "0912345678"]) assert.ok((await numbers({ q })).includes(target.orderNo), q);
  assert.ok((await numbers({ q: "1", drop: undefined })).includes(target.orderNo), "unit number 001");
  assert.ok(!(await numbers({ q: "%" })).includes(target.orderNo), "% is just a character");
  assert.ok(!(await numbers({ q: target.orderNo, status: "paid" })).length);
  assert.ok(!(await numbers({ q: target.orderNo, drop: 999_999 })).length);
  const owed = (await searchOrders(ops, { q: target.orderNo, owed: true }))!;
  assert.equal(owed[0].owedVnd, 2 * 41_000);
  const seen = (await staffOrder(ops, target.orderNo))!;
  assert.deepEqual([seen.payments.length, seen.owed.length], [2, 2]);
  ok("staff find orders by number, email, phone or unit, see what's owed; Support and Community can't");

  // paying and deleting the account at the same moment: never a paid order on a deleted account
  const spare = buyers.slice(3);
  const results2: string[] = [];
  for (let i = 0; i < 6; i++) {
    await reset();
    const who = spare[spare.length - 1 - i];
    const held = await take(who);
    const txn = await start(who);
    const amount = await total(who, txn);
    await lapse(held.holdId);
    const [paid, deletion] = await Promise.all([
      new Promise((resolve) => setTimeout(resolve, i * 3)).then(() => confirmPayment(txn, amount, "success")), deleteAccount(who),
    ]);
    const [row] = await db.select().from(account).where(eq(account.id, who));
    const deleted = !row || row.email.endsWith("@deleted.invalid");
    assert.equal(deleted, deletion === "deleted");
    assert.ok(!(deleted && paid.result === "paid"), "paid to a deleted account");
    if (deleted) gone.push(who);
    results2.push(`${paid.result}/${deletion}`);
  }
  ok(`a payment racing an account deletion, 6 times (${[...new Set(results2)].join(", ")}): never paid and deleted`);
  buyers.length = BUYERS - 6; // those six may be gone

  // staff closing the drop with a payment on the way
  await reset();
  await take(a);
  const flying = await start(a);
  await db.update(dropRun).set({ state: "closed" }).where(eq(dropRun.id, drop.id));
  assert.deepEqual(await startPayment(a, "momo", randomUUID()), { ok: false, error: "closed" });
  assert.equal((await confirm(a, flying)).result, "refunded");
  assert.deepEqual((await refundsOf(a)).map((r) => r.reason), ["drop_closed"]);
  assert.notEqual((await unit(1)).status, "sold");
  await db.update(dropRun).set({ state: "scheduled" }).where(eq(dropRun.id, drop.id));
  ok("once staff close a drop no payment starts, and one already on its way is refunded");

  await reset();
  const mine = await take(a);
  const late = await start(a);
  await lapse(mine.holdId);
  const theirs = await take(b);
  assert.equal(theirs.number, mine.number);
  assert.equal((await confirm(a, late)).result, "refunded");
  assert.equal((await unit(mine.number)).holdId, theirs.holdId, "the new holder keeps it");
  assert.equal((await ordersOf(a))[0].status, "refunded");
  assert.deepEqual((await refundsOf(a)).map((r) => r.reason), ["unit_taken"]);
  assert.equal((await confirm(b, await start(b))).result, "paid");
  ok("paid after the hold ran out and the number went to someone else: refund, and the new holder can buy it");

  await reset();
  const own = await take(a);
  const slow = await start(a);
  await lapse(own.holdId);
  await expireStaleOrders(a);
  assert.equal((await ordersOf(a))[0].status, "cancelled");
  assert.equal((await listOrders(a)).length, 0, "an abandoned payment isn't listed");
  assert.ok(await findOrder(a, (await ordersOf(a))[0].orderNo), "but its page still opens");
  assert.equal((await confirm(a, slow)).result, "paid");
  assert.equal((await listOrders(a)).length, 1);
  assert.equal((await unit(own.number)).status, "sold");
  assert.equal((await db.select().from(orderLine).where(and(eq(orderLine.editionUnitId, (await unit(own.number)).id), isNull(orderLine.releasedAt)))).length, 1);
  ok("paid after the hold ran out with the number still free: the buyer gets it, even if the order was cancelled");

  await reset();
  const first = await take(a);
  const old = await start(a);
  await lapse(first.holdId);
  await take(b); // takes number 1
  const second = await take(a);
  assert.notEqual(second.number, first.number);
  const current = await start(a);
  assert.equal((await ordersOf(a)).filter((o) => o.status === "pending").length, 1);
  await releaseHold(b, (await db.select().from(hold).where(and(eq(hold.accountId, b), eq(hold.status, "active"))))[0].id);
  assert.equal((await confirm(a, current)).result, "paid");
  assert.equal((await confirm(a, old)).result, "refunded");
  assert.deepEqual((await refundsOf(a)).map((r) => r.reason), ["cap"]);
  assert.equal((await unit(first.number)).status, "available");
  ok("an old payment arriving after a new purchase can't get past the cap");

  await reset();
  const gonner = await take(c);
  const afterDelete = await start(c);
  await lapse(gonner.holdId);
  assert.equal(await deleteAccount(c), "deleted", "an abandoned payment doesn't block deleting");
  gone.push(c);
  assert.equal((await confirm2(afterDelete)).result, "refunded");
  assert.equal((await unit(gonner.number)).status, "available");
  ok("money arriving for a deleted account is refunded and sells nothing");

  // 30 buyers, 5 units: five hold and start paying, their holds run out, others take over, then everyone's money lands
  for (let round = 1; round <= 3; round++) {
    await reset();
    const people = buyers.slice(3);
    const attempts: { who: string; txn: string; amount: number }[] = [];
    const wave = async (group: string[]) => {
      const got = await Promise.all(group.map(async (who) => ({ who, held: await holdUnit(who, run.id) })));
      for (const { who, held } of got) {
        if (!held.ok) continue;
        const txn = await start(who);
        attempts.push({ who, txn, amount: await total(who, txn) });
      }
    };
    await wave(people.slice(0, 12));
    await db.execute(sql`update hold set expires_at = now() - interval '1 second' where edition_id = ${run.id} and status = 'active'`);
    await db.execute(sql`update edition_unit set held_until = now() - interval '1 second' where edition_id = ${run.id} and status = 'held'`);
    await Promise.all([wave(people.slice(12)), ...attempts.slice(0, 5).map((x) => confirmPayment(x.txn, x.amount, "success"))]);
    const results: Confirmed[] = await Promise.all(attempts.map((x) => confirmPayment(x.txn, x.amount, "success")));

    const sold = (await db.select().from(editionUnit).where(and(eq(editionUnit.editionId, run.id), eq(editionUnit.status, "sold")))).length;
    const paidOrders = (await db.select().from(customerOrder).where(and(inArray(customerOrder.accountId, people), eq(customerOrder.status, "paid")))).length;
    const claims = await db.select({ unitId: orderLine.editionUnitId, status: customerOrder.status }).from(orderLine)
      .innerJoin(customerOrder, eq(orderLine.orderId, customerOrder.id))
      .where(and(inArray(customerOrder.accountId, people), isNull(orderLine.releasedAt)));
    assert.equal(sold, paidOrders, `round ${round}: every sold unit has one paid order`);
    assert.ok(sold <= UNITS);
    assert.equal(new Set(claims.map((x) => x.unitId)).size, claims.length, "no unit claimed twice");
    assert.ok(claims.every((x) => x.status === "paid"));
    // every successful charge ended in exactly one of: a paid order, or a recorded refund
    const refunds = (await Promise.all(people.map(refundsOf))).flat().length;
    assert.equal(paidOrders + refunds, attempts.length);
    assert.equal(results.filter((r) => r.result === "paid").length, paidOrders);
    const kept = await db.select({ orderId: payment.orderId, amount: payment.amountVnd, total: customerOrder.totalVnd }).from(payment)
      .innerJoin(customerOrder, eq(payment.orderId, customerOrder.id))
      .where(and(inArray(customerOrder.accountId, people), eq(customerOrder.status, "paid"), eq(payment.status, "succeeded"),
        sql`not exists (select 1 from refund r where r.payment_id = ${payment.id})`));
    assert.equal(kept.length, paidOrders);
    assert.equal(new Set(kept.map((x) => x.orderId)).size, paidOrders);
    assert.ok(kept.every((x) => x.amount === x.total));
    if (round === 3) ok(`${attempts.length} charges for ${UNITS} units, 3 rounds: never oversold, and every charge ended as an order or a refund (last round ${paidOrders} + ${refunds})`);
  }

  /** For a deleted account, whose payment can no longer be looked up as its owner. */
  async function confirm2(txn: string) {
    const [row] = await db.select().from(payment).where(eq(payment.providerTxnId, txn));
    return confirmPayment(txn, row.amountVnd, "success");
  }
}

main()
  .then(() => console.log("Payment check passed"), (error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanUp(); process.exit(process.exitCode ?? 0); });
