// Proves one account can't see or change another's addresses or orders, against a real Postgres (CI has none).
// Run: npm run check:account
// Also proves what deleting an account removes. Makes two test accounts, a drop and an order, and removes them after. Refuses to run against a database elsewhere.
import assert from "node:assert/strict";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "../src/db";
import { account, address, customerOrder, dropRun, edition, editionUnit, hold, orderLine, tier, variant } from "../src/db/schema";
import { deleteAccount } from "../src/lib/account-delete";
import { listAddresses, makeDefault, MAX_ADDRESSES, removeAddress, writeAddress } from "../src/lib/addresses";
import { findOrder, listOrders } from "../src/lib/orders";

const MAIL = "@account.statix.test";
const TEST_DROP = 900_998; // a late number, so it is never the current drop
const gone: string[] = []; // anonymised accounts no longer match MAIL

async function cleanUp() {
  const people = [...gone, ...(await db.select({ id: account.id }).from(account).where(like(account.email, `%${MAIL}`))).map((a) => a.id)];
  // by order number too, so a run that stopped half way is still cleared up
  const [left] = await db.select({ accountId: customerOrder.accountId }).from(customerOrder).where(eq(customerOrder.orderNo, "CHECK-ACCOUNT-1"));
  if (left) people.push(left.accountId);
  if (people.length) {
    const orders = (await db.select({ id: customerOrder.id }).from(customerOrder).where(inArray(customerOrder.accountId, people))).map((o) => o.id);
    if (orders.length) await db.delete(orderLine).where(inArray(orderLine.orderId, orders));
    await db.delete(customerOrder).where(inArray(customerOrder.accountId, people));
  }
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, TEST_DROP));
  if (drop) {
    const runs = (await db.select({ id: edition.id }).from(edition).where(eq(edition.dropId, drop.id))).map((e) => e.id);
    if (runs.length) {
      await db.delete(editionUnit).where(inArray(editionUnit.editionId, runs));
      await db.delete(hold).where(inArray(hold.editionId, runs));
      await db.delete(edition).where(inArray(edition.id, runs));
    }
    await db.delete(dropRun).where(eq(dropRun.id, drop.id));
  }
  if (people.length) await db.delete(account).where(inArray(account.id, people));
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Refusing to run against ${host}: this creates and deletes rows`);
  await cleanUp();
  const [member] = await db.select().from(tier).where(eq(tier.code, "member"));
  const [ada, bob] = (await db.insert(account).values(["ada", "bob"].map((name) => ({ email: name + MAIL, tierId: member.id })))
    .returning({ id: account.id })).map((a) => a.id);
  const ok = (message: string) => console.log(`  ok  ${message}`);
  const place = (recipient: string) => ({ recipient, receiverPhone: "+84912345678", province: "Hà Nội", ward: "Ward 1", street: "1 Test Street" });
  const defaults = async (id: string) => (await listAddresses(id)).filter((row) => row.isDefault).length;

  const added = await Promise.all(Array.from({ length: MAX_ADDRESSES + 5 }, (_, i) => writeAddress(ada, place(`A${String(i).padStart(2, "0")}`))));
  assert.equal(added.filter((r) => r === "ok").length, MAX_ADDRESSES);
  assert.equal((await listAddresses(ada)).length, MAX_ADDRESSES);
  assert.equal(await defaults(ada), 1);
  ok(`${MAX_ADDRESSES + 5} adds at once: ${MAX_ADDRESSES} saved, exactly one default`);

  const mine = await listAddresses(ada);
  await Promise.all(mine.map((row) => makeDefault(ada, row.id)));
  assert.equal(await defaults(ada), 1);
  await removeAddress(ada, (await listAddresses(ada))[0].id);
  assert.equal(await defaults(ada), 1);
  ok("still one default after changing it all at once, and after deleting it");

  const target = (await listAddresses(ada))[1];
  assert.equal((await listAddresses(bob)).length, 0);
  assert.equal(await writeAddress(bob, place("Bob"), target.id), "gone");
  assert.equal(await makeDefault(bob, target.id), false);
  assert.equal(await removeAddress(bob, target.id), false);
  const [after] = await db.select().from(address).where(eq(address.id, target.id));
  assert.deepEqual(after, target);
  ok("another account can't read, edit, default or delete an address, even with its id");

  await db.insert(customerOrder).values({ orderNo: "CHECK-ACCOUNT-1", accountId: ada, paymentMethod: "cod", subtotalVnd: 1, shippingVnd: 1, totalVnd: 2, shipTo: place("Ada") });
  assert.equal((await findOrder(ada, "CHECK-ACCOUNT-1"))?.totalVnd, 2);
  assert.equal((await listOrders(ada)).length, 1);
  assert.equal(await findOrder(bob, "CHECK-ACCOUNT-1"), null);
  assert.equal((await listOrders(bob)).length, 0);
  ok("another account can't list or open an order, even with its number");

  // deleting: ada has an order and a hold on a made-up drop; bob has neither
  const [drop] = await db.insert(dropRun).values({ number: TEST_DROP, name: "Account check", state: "scheduled" }).returning();
  const [anyVariant] = await db.select().from(variant).limit(1);
  const [run] = await db.insert(edition).values({ dropId: drop.id, variantId: anyVariant.id, size: 2, priceVnd: 1 }).returning();
  const [bought, kept] = await db.insert(editionUnit).values([{ editionId: run.id, number: 1, status: "sold" as const }, { editionId: run.id, number: 2 }]).returning();
  const [order] = await db.select().from(customerOrder).where(eq(customerOrder.orderNo, "CHECK-ACCOUNT-1"));
  await db.insert(orderLine).values({ orderId: order.id, editionUnitId: bought.id, priceVnd: 1 });
  const holding = async (who: string) => {
    const [made] = await db.insert(hold).values({ accountId: who, editionId: run.id, expiresAt: new Date(Date.now() + 600_000) }).returning();
    await db.update(editionUnit).set({ status: "held", holdId: made.id, heldUntil: made.expiresAt }).where(eq(editionUnit.id, kept.id));
  };
  const unit = async () => (await db.select().from(editionUnit).where(eq(editionUnit.id, kept.id)))[0];

  assert.equal(await deleteAccount(ada), "openOrder");
  await db.update(customerOrder).set({ status: "completed" }).where(eq(customerOrder.id, order.id));
  assert.equal(await deleteAccount(ada), "openDrop");
  await db.update(dropRun).set({ state: "closed" }).where(eq(dropRun.id, drop.id));
  assert.equal((await listAddresses(ada)).length, MAX_ADDRESSES - 1, "a refusal deletes nothing");
  ok("deleting is refused with an order in progress, or a purchase from a drop still open");

  await writeAddress(bob, place("Bob"));
  await holding(bob);
  assert.equal(await deleteAccount(bob), "deleted");
  assert.equal((await db.select().from(account).where(eq(account.id, bob))).length, 0);
  assert.equal((await unit()).status, "available");
  assert.equal((await listAddresses(ada)).length, MAX_ADDRESSES - 1, "only the deleted account's rows go");
  ok("an account with no orders goes completely, and its held unit goes back on sale");

  await holding(ada);
  assert.equal(await deleteAccount(ada), "deleted");
  const [shell] = await db.select().from(account).where(eq(account.id, ada));
  assert.deepEqual([shell.email, shell.phone, shell.passwordHash, shell.emailVerified], [`${ada}@deleted.invalid`, null, null, false]);
  assert.ok(shell.passwordChangedAt);
  assert.equal((await listAddresses(ada)).length, 0);
  assert.equal((await unit()).status, "available");
  assert.equal((await listOrders(ada)).length, 1);
  ok("an account with orders keeps them, and loses everything that names the person");
  gone.push(ada);
}

main()
  .then(() => console.log("Account check passed"), (error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanUp(); process.exit(process.exitCode ?? 0); });
