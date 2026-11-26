// Proves the hold engine can't oversell, against a real Postgres (CI has none, so this isn't part of npm test).
// Run: npm run check:holds
// It makes its own drop (number -999, so it is never the current one) and test accounts, and removes them after.
// It never changes a real drop. Refuses to run against a database that isn't on this machine.
import assert from "node:assert/strict";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../src/db";
import { account, dropRun, edition, editionUnit, hold, invite, tier, variant, waitlistEntry } from "../src/db/schema";
import { getDrop } from "../src/lib/catalogue";
import { activeHolds, extendHold, holdUnit, releaseHold } from "../src/lib/holds";

const TEST_DROP = -999;
const UNITS = 5;
const BUYERS = 30;
const MAIL = "@holds.statix.test";
const hour = 3_600_000;

async function cleanUp() {
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, TEST_DROP));
  const people = (await db.select({ id: account.id }).from(account).where(like(account.email, `%${MAIL}`))).map((a) => a.id);
  if (drop) {
    const editions = (await db.select({ id: edition.id }).from(edition).where(eq(edition.dropId, drop.id))).map((e) => e.id);
    if (editions.length) {
      await db.delete(editionUnit).where(inArray(editionUnit.editionId, editions));
      await db.delete(hold).where(inArray(hold.editionId, editions));
      await db.delete(edition).where(inArray(edition.id, editions));
    }
    await db.delete(waitlistEntry).where(eq(waitlistEntry.dropId, drop.id));
    await db.delete(dropRun).where(eq(dropRun.id, drop.id));
  }
  if (people.length) await db.delete(account).where(inArray(account.id, people));
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Refusing to run against ${host}: this creates and deletes rows`);
  await cleanUp();
  const current = (await getDrop())?.number;

  const [drop] = await db.insert(dropRun).values({
    number: TEST_DROP, name: "Hold check", state: "scheduled",
    earlyAccessAt: new Date(Date.now() - 2 * hour), publicAt: new Date(Date.now() - hour),
  }).returning();
  const [anyVariant] = await db.select().from(variant).limit(1);
  const [run] = await db.insert(edition).values({ dropId: drop.id, variantId: anyVariant.id, size: UNITS, priceVnd: 1, perPersonCap: 1 }).returning();
  await db.insert(editionUnit).values(Array.from({ length: UNITS }, (_, i) => ({ editionId: run.id, number: i + 1 })));
  const [member] = await db.select().from(tier).where(eq(tier.code, "member"));
  const buyers = (await db.insert(account).values(Array.from({ length: BUYERS }, (_, i) => ({
    email: `buyer${i}${MAIL}`, emailVerified: true, phone: `+8400000${String(i).padStart(4, "0")}`, phoneVerified: true, tierId: member.id,
  }))).returning({ id: account.id })).map((a) => a.id);

  const reset = async () => {
    await db.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null }).where(eq(editionUnit.editionId, run.id));
    await db.delete(hold).where(eq(hold.editionId, run.id));
  };
  const held = async () => (await db.select().from(editionUnit).where(and(eq(editionUnit.editionId, run.id), eq(editionUnit.status, "held")))).length;
  const left = async () => (await getDrop(TEST_DROP))!.editions[0].left;
  const ok = (message: string) => console.log(`  ok  ${message}`);

  assert.equal((await getDrop())?.number, current, "the test drop must never become the current one");

  for (let round = 1; round <= 5; round++) {
    await reset();
    const results = await Promise.all(buyers.map((id) => holdUnit(id, run.id)));
    const won = results.flatMap((r) => (r.ok ? [r.number] : []));
    assert.deepEqual([...won].sort((a, b) => a - b), [1, 2, 3, 4, 5], `round ${round}: numbers ${won}`);
    assert.equal(results.filter((r) => !r.ok && r.error === "soldOut").length, BUYERS - UNITS);
    assert.equal(await held(), UNITS);
    assert.equal(await left(), 0);
  }
  ok(`${BUYERS} buyers at once for ${UNITS} units, 5 rounds: exactly ${UNITS} holds, numbers 1 to ${UNITS}, no number twice`);

  await reset();
  const clicks = await Promise.all(Array.from({ length: 12 }, () => holdUnit(buyers[0], run.id)));
  assert.equal(new Set(clicks.map((r) => (r.ok ? r.holdId : r.error))).size, 1);
  assert.equal(await held(), 1);
  ok("one person asking 12 times at once holds one unit");

  await reset();
  const everyone = await Promise.all(buyers.slice(0, UNITS).map((id) => holdUnit(id, run.id)));
  assert.ok(everyone.every((r) => r.ok));
  const first = everyone[0] as Extract<(typeof everyone)[number], { ok: true }>;
  await db.execute(sql`update hold set expires_at = now() - interval '1 second' where id = ${first.holdId}`);
  await db.execute(sql`update edition_unit set held_until = now() - interval '1 second' where hold_id = ${first.holdId}`);
  assert.equal(await left(), 1, "a run-out hold counts as left");
  assert.equal((await activeHolds(buyers[0])).length, 0);
  const next = await holdUnit(buyers[10], run.id);
  assert.ok(next.ok && next.number === first.number);
  const [old] = await db.select().from(hold).where(eq(hold.id, first.holdId));
  assert.equal(old.status, "expired");
  ok("a run-out hold counts as left, and the next buyer takes that number");

  assert.deepEqual(await holdUnit(buyers[0], run.id), { ok: false, error: "soldOut" });
  const mine = (await activeHolds(buyers[10]))[0];
  assert.equal(await releaseHold(buyers[0], mine.id), false, "only the holder can release");
  assert.equal(await releaseHold(buyers[10], mine.id), true);
  const again = await holdUnit(buyers[0], run.id);
  assert.ok(again.ok && again.number === first.number && !again.already);
  ok("someone whose hold ran out can hold again; only the holder can release");

  // run out with nobody else taking it: the same person asks again
  await db.execute(sql`update hold set expires_at = now() - interval '1 second' where id = ${(again as { holdId: string }).holdId}`);
  await db.execute(sql`update edition_unit set held_until = now() - interval '1 second' where hold_id = ${(again as { holdId: string }).holdId}`);
  const renewed = await holdUnit(buyers[0], run.id);
  assert.ok(renewed.ok && !renewed.already);
  ok("asking again after your own hold ran out gives a new hold");

  const holdId = (renewed as { holdId: string }).holdId;
  assert.equal(await extendHold(buyers[1], holdId), null);
  const longer = await extendHold(buyers[0], holdId);
  assert.ok(longer && longer.getTime() - (renewed as { expiresAt: Date }).expiresAt.getTime() === 600_000);
  assert.equal(await extendHold(buyers[0], holdId), null, "only once");
  ok("a hold extends once, by 10 minutes, for its holder");

  await reset();
  await db.update(dropRun).set({ publicAt: new Date(Date.now() + hour) }).where(eq(dropRun.id, drop.id));
  assert.deepEqual(await holdUnit(buyers[2], run.id), { ok: false, error: "needInvite" });
  const [entry] = await db.insert(waitlistEntry).values({ email: `buyer2${MAIL}`, emailNorm: `buyer2${MAIL}`, dropId: drop.id, status: "invited", consentAt: new Date() }).returning();
  await db.insert(invite).values({ entryId: entry.id, tokenHash: "hold-check", expiresAt: new Date(Date.now() + hour) });
  assert.deepEqual(await holdUnit(buyers[2], run.id), { ok: false, error: "needInvite" }, "an unaccepted invite isn't enough");
  await db.update(invite).set({ usedAt: new Date(), accountId: buyers[2] }).where(eq(invite.entryId, entry.id));
  assert.ok((await holdUnit(buyers[2], run.id)).ok);
  assert.deepEqual(await holdUnit(buyers[3], run.id), { ok: false, error: "needInvite" });
  ok("in early access only the account that accepted an invite for this drop gets a unit");

  await db.update(account).set({ phoneVerified: false }).where(eq(account.id, buyers[4]));
  await db.update(dropRun).set({ publicAt: new Date(Date.now() - hour) }).where(eq(dropRun.id, drop.id));
  assert.deepEqual(await holdUnit(buyers[4], run.id), { ok: false, error: "needPhone" });
  await db.update(dropRun).set({ earlyAccessAt: new Date(Date.now() + hour), publicAt: new Date(Date.now() + 2 * hour) }).where(eq(dropRun.id, drop.id));
  assert.deepEqual(await holdUnit(buyers[5], run.id), { ok: false, error: "notOpen" });
  ok("no phone, or not open yet: refused");
}

main()
  .then(() => console.log("Hold check passed"), (error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanUp(); process.exit(process.exitCode ?? 0); });
