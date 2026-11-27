// Proves staff can't edit a drop into a bad state, against a real Postgres (CI has none).
// Run: npm run check:drops
// Makes two test drops, staff and buyers, and removes them, audit rows included (needs the local superuser). While it
// runs, a scheduled test drop is the newest, so the local site shows it. Refuses to run against another machine.
import assert from "node:assert/strict";
import { and, asc, eq, gt, inArray, like, sql } from "drizzle-orm";
import { db } from "../src/db";
import { account, adminUser, auditLog, dropRun, edition, editionUnit, hold, tier } from "../src/db/schema";
import { addEdition, allVariants, createDrop, findDrop, scheduleDrop, updateDrop, updateEdition } from "../src/lib/admin-drops";
import { holdUnit } from "../src/lib/holds";
import type { Staff } from "../src/lib/staff";

const NUMBERS = [900_001, 900_002];
const MAIL = "@drops.statix.test";
const BUYERS = 30;
const hour = 3_600_000;

async function cleanUp() {
  const drops = (await db.select().from(dropRun).where(inArray(dropRun.number, NUMBERS))).map((d) => d.id);
  const editions = drops.length ? (await db.select({ id: edition.id }).from(edition).where(inArray(edition.dropId, drops))).map((e) => e.id) : [];
  const staff = (await db.select({ id: adminUser.id }).from(adminUser).where(like(adminUser.email, `%${MAIL}`))).map((a) => a.id);
  await db.transaction(async (tx) => {
    if (staff.length) {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(auditLog).where(inArray(auditLog.adminId, staff));
      await tx.execute(sql`set local session_replication_role = origin`);
      await tx.delete(adminUser).where(inArray(adminUser.id, staff));
    }
    if (editions.length) {
      await tx.delete(editionUnit).where(inArray(editionUnit.editionId, editions));
      await tx.delete(hold).where(inArray(hold.editionId, editions));
      await tx.delete(edition).where(inArray(edition.id, editions));
    }
    if (drops.length) await tx.delete(dropRun).where(inArray(dropRun.id, drops));
    await tx.delete(account).where(like(account.email, `%${MAIL}`));
  });
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Refusing to run against ${host}: this creates and deletes rows`);
  await cleanUp();
  const ok = (message: string) => console.log(`  ok  ${message}`);
  const people = await db.insert(adminUser).values((["owner", "ops", "fulfilment", "support", "community"] as const)
    .map((role) => ({ email: role + MAIL, role }))).returning({ id: adminUser.id, email: adminUser.email, role: adminUser.role });
  const staff = Object.fromEntries(people.map((p) => [p.role, p])) as Record<Staff["role"], Staff>;
  const logged = async () => (await db.select().from(auditLog).where(inArray(auditLog.adminId, people.map((p) => p.id))).orderBy(asc(auditLog.at))).length;

  /** An accepted change writes exactly one audit row; a refused one writes none. */
  const expect = async (run: () => ReturnType<typeof createDrop>, error: string | null, rows = error ? 0 : 1) => {
    const before = await logged();
    const result = await run();
    assert.equal(result.ok ? null : result.error, error);
    assert.equal(await logged(), before + rows, `audit rows after ${error ?? "an accepted change"}`);
  };

  const [number, second] = NUMBERS;
  const soon = { name: "Drop check", earlyAccessAt: new Date(Date.now() + hour), publicAt: new Date(Date.now() + 2 * hour), closeAt: null };
  const variants = await allVariants();
  const terms = { size: 20, priceVnd: 1000, perPersonCap: 1 };

  for (const role of ["fulfilment", "support", "community"] as const) await expect(() => createDrop(staff[role], number, soon), "denied");
  await expect(() => createDrop(staff.ops, number, soon), null);
  await expect(() => createDrop(staff.ops, number, soon), "numberTaken");
  await expect(() => createDrop(staff.ops, 0, soon), "badNumber");
  await expect(() => scheduleDrop(staff.owner, number), "noEditions");
  await expect(() => addEdition(staff.support, number, variants[0].id, terms), "denied");
  await expect(() => addEdition(staff.owner, number, variants[0].id, { ...terms, size: 0 }), "badSize");
  await expect(() => addEdition(staff.owner, number, variants[0].id, terms), null);
  await expect(() => addEdition(staff.owner, number, variants[0].id, terms), "variantTaken");
  const editionId = (await findDrop(number))!.editions[0].id;
  await expect(() => updateEdition(staff.support, editionId, { ...terms, priceVnd: 1 }), "denied");
  await expect(() => updateDrop(staff.support, number, soon), "denied");
  await expect(() => scheduleDrop(staff.fulfilment, number), "denied");
  ok("only Owner and Ops can change drops; refusals change nothing and are not logged as changes");

  const run = async () => {
    const [row] = await db.select().from(edition).where(eq(edition.id, editionId));
    const numbers = (await db.select({ n: editionUnit.number }).from(editionUnit).where(eq(editionUnit.editionId, editionId)).orderBy(asc(editionUnit.number))).map((u) => u.n);
    assert.deepEqual(numbers, Array.from({ length: row.size }, (_, i) => i + 1), "units are exactly 1 to size");
    return row.size;
  };
  assert.equal(await run(), 20);
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 25 }), null);
  assert.equal(await run(), 25);
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 10 }), null);
  assert.equal(await run(), 10);
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 10 }), null, 0);
  ok("500 units on save and after (US-008): numbers stay 1 to size, and saving nothing new logs nothing");

  await db.update(dropRun).set({ publicAt: null, earlyAccessAt: null }).where(eq(dropRun.number, number));
  await expect(() => scheduleDrop(staff.owner, number), "noPublicTime");
  await expect(() => updateDrop(staff.owner, number, { ...soon, earlyAccessAt: new Date(Date.now() - hour) }), null);
  await expect(() => scheduleDrop(staff.owner, number), "inThePast");
  await expect(() => updateDrop(staff.owner, number, soon), null);
  await db.delete(editionUnit).where(and(eq(editionUnit.editionId, editionId), eq(editionUnit.number, 4)));
  await expect(() => scheduleDrop(staff.owner, number), "unitCount");
  await db.insert(editionUnit).values({ editionId, number: 4 });
  await expect(() => scheduleDrop(staff.owner, number), null);
  await expect(() => scheduleDrop(staff.owner, number), "notDraft");
  await expect(() => updateDrop(staff.owner, number, { ...soon, publicAt: null }), "noPublicTime");
  ok("a drop is scheduled only with ordered future times and whole runs, and stays that way");

  const [member] = await db.select().from(tier).where(eq(tier.code, "member"));
  const buyers = (await db.insert(account).values(Array.from({ length: BUYERS }, (_, i) => ({
    email: `buyer${i}${MAIL}`, emailVerified: true, phone: `+8400009${String(i).padStart(4, "0")}`, phoneVerified: true, tierId: member.id,
  }))).returning({ id: account.id })).map((a) => a.id);
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, number));
  const open = () => db.update(dropRun).set({ earlyAccessAt: new Date(Date.now() - 2 * hour), publicAt: new Date(Date.now() - hour) }).where(eq(dropRun.id, drop.id));
  /** As an edit sees it when it started just before the opening. */
  const unopened = () => db.update(dropRun).set({ publicAt: null, earlyAccessAt: null }).where(eq(dropRun.id, drop.id));
  /** An unheld run of 40. */
  const fresh = async () => {
    await db.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null }).where(eq(editionUnit.editionId, editionId));
    await db.delete(hold).where(eq(hold.editionId, editionId));
    await db.update(edition).set({ size: 40 }).where(eq(edition.id, editionId));
    await db.execute(sql`insert into edition_unit (edition_id, number) select ${editionId}::uuid, n from generate_series(1, 40) n on conflict do nothing`);
  };

  // The race that matters, forced: a hold has taken a unit but not committed when the shrink gets to that row.
  await fresh();
  await unopened();
  let settled = false;
  let shrinking!: ReturnType<typeof updateEdition>;
  await db.transaction(async (tx) => {
    await tx.update(editionUnit).set({ status: "held", heldUntil: new Date(Date.now() + hour) })
      .where(and(eq(editionUnit.editionId, editionId), eq(editionUnit.number, 30)));
    shrinking = updateEdition(staff.owner, editionId, { ...terms, size: 10 }).finally(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 700));
    assert.equal(settled, false, "the shrink waits for the row the hold has");
  });
  assert.deepEqual(await shrinking, { ok: false, error: "unitsInUse" });
  assert.equal(await run(), 40);
  ok("a shrink that meets a hold in progress waits for it, then is refused whole");

  // and real buyers all at once with a shrink: whatever the timing gives, no hold may lose its unit
  const outcomes: string[] = [];
  for (let round = 0; round < 6; round++) {
    await fresh();
    await open();
    const [taken, result] = await Promise.all([
      Promise.all(buyers.map((id) => holdUnit(id, editionId))),
      new Promise((resolve) => setTimeout(resolve, round * 4)).then(unopened)
        .then(() => updateEdition(staff.owner, editionId, { ...terms, size: 10 })),
    ]);
    const size = await run();
    assert.equal(size, result.ok ? 10 : 40);
    outcomes.push(result.ok ? "shrunk" : result.error);
    for (const got of taken) {
      if (!got.ok) continue;
      const [unit] = await db.select().from(editionUnit).where(eq(editionUnit.holdId, got.holdId));
      assert.equal(unit?.number, got.number, "every hold still has its unit");
    }
    assert.equal((await db.select().from(editionUnit).where(and(eq(editionUnit.editionId, editionId), gt(editionUnit.number, size)))).length, 0);
  }
  ok(`${BUYERS} buyers at once with a shrink, 6 rounds (${outcomes.join(", ")}): no hold lost its unit, no gaps`);

  // a shrink on its own, with someone holding a number above the new size
  await fresh();
  await open();
  const held = await Promise.all(buyers.slice(0, 15).map((id) => holdUnit(id, editionId)));
  assert.ok(held.every((h) => h.ok));
  await unopened();
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 14 }), "unitsInUse");
  assert.equal(await run(), 40, "refused as a whole: the free rows above were not removed either");
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 15 }), null);
  await db.execute(sql`update edition_unit set held_until = now() - interval '1 second' where edition_id = ${editionId} and number = 15`);
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 14 }), null);
  assert.equal(await run(), 14);
  ok("a size can't drop under a held number; once that hold has run out it can (FR-097)");

  await open();
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 14, priceVnd: 2000 }), "locked");
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 100 }), "locked");
  await expect(() => addEdition(staff.owner, number, variants[1].id, terms), "locked");
  await expect(() => updateDrop(staff.owner, number, soon), "locked");
  await db.update(dropRun).set({ earlyAccessAt: new Date(Date.now() - hour), publicAt: new Date(Date.now() + hour) }).where(eq(dropRun.id, drop.id));
  await expect(() => updateEdition(staff.owner, editionId, { ...terms, size: 14, priceVnd: 2000 }), "locked");
  ok("from early access on, nothing changes: price, size, new editions, times (US-097 AC2 and stricter)");

  await expect(() => createDrop(staff.owner, second, { ...soon, earlyAccessAt: null, publicAt: null }), null);
  await expect(() => updateEdition(staff.owner, "00000000-0000-0000-0000-000000000000", terms), "gone");
  const trail = await db.select().from(auditLog).where(and(eq(auditLog.entityId, editionId), eq(auditLog.action, "update"))).orderBy(asc(auditLog.at));
  assert.deepEqual(trail[0].oldValue, terms);
  assert.deepEqual(trail[0].newValue, { ...terms, size: 25 });
  ok("each accepted change has one audit row with the before and after values");
}

main()
  .then(() => console.log("Drop check passed"), (error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanUp(); process.exit(process.exitCode ?? 0); });
