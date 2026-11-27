// Proves staff sign-in, sessions and the append-only audit log, against a real Postgres (CI has none).
// Run: npm run check:staff
// Makes test staff and removes them, audit rows included, which takes the local database's superuser.
// Refuses to run against a database that isn't on this machine.
import assert from "node:assert/strict";
import { eq, inArray, like, sql } from "drizzle-orm";
import { db } from "../src/db";
import { adminSession, adminUser, auditLog } from "../src/db/schema";
import { can, createStaff, readAudit, signInStaff, signOutStaff, staffFor } from "../src/lib/staff";
import { codeAt } from "../src/lib/totp";

const MAIL = "@staff.statix.test";
const PASSWORD = "staff-check-password-1";

async function cleanUp() {
  const ids = (await db.select({ id: adminUser.id }).from(adminUser).where(like(adminUser.email, `%${MAIL}`))).map((a) => a.id);
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`); // the only way past the append-only trigger
    await tx.delete(auditLog).where(inArray(auditLog.entityId, ids));
    await tx.delete(adminSession).where(inArray(adminSession.adminId, ids));
    await tx.delete(adminUser).where(inArray(adminUser.id, ids));
  });
}

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`Refusing to run against ${host}: this creates and deletes rows`);
  await cleanUp();
  const ok = (message: string) => console.log(`  ok  ${message}`);
  const email = `owner${MAIL}`;
  const { id, secret } = await createStaff(email, "owner", PASSWORD);
  const now = Date.now();
  const step = Math.floor(now / 30_000);

  const [stored] = await db.select().from(adminUser).where(eq(adminUser.id, id));
  assert.ok(!stored.mfaSecret!.includes(secret) && !stored.passwordHash!.includes(PASSWORD));
  ok("neither the password nor the authenticator key is stored as written");

  const wrong = codeAt(secret, step + 20);
  assert.equal(await signInStaff(email, "not-the-password-123", codeAt(secret, step), now), null);
  assert.equal(await signInStaff(email, PASSWORD, wrong, now), null);
  assert.equal(await signInStaff(email, PASSWORD, "", now), null);
  assert.equal(await signInStaff(`nobody${MAIL}`, PASSWORD, codeAt(secret, step), now), null);
  ok("a wrong password, a wrong or missing code, or an unknown email: no session");

  const tries = await Promise.all(Array.from({ length: 8 }, () => signInStaff(email, PASSWORD, codeAt(secret, step), now)));
  const tokens = tries.filter((token) => token !== null);
  assert.equal(tokens.length, 1);
  assert.equal(await signInStaff(email, PASSWORD, codeAt(secret, step), now), null);
  ok("one code sent 8 times at once, then again: exactly one session");

  const token = tokens[0]!;
  assert.deepEqual(await staffFor(token), { id, email, role: "owner" });
  assert.equal(await staffFor("made-up"), null);
  const [session] = await db.select().from(adminSession).where(eq(adminSession.adminId, id));
  assert.notEqual(session.tokenHash, token);
  await db.update(adminUser).set({ role: "support" }).where(eq(adminUser.id, id));
  assert.equal((await staffFor(token))!.role, "support");
  assert.equal(can("support", "audit"), false);
  assert.equal(can("owner", "audit"), true);
  await db.update(adminUser).set({ mfaEnabled: false }).where(eq(adminUser.id, id));
  assert.equal(await staffFor(token), null);
  assert.equal(await signInStaff(email, PASSWORD, codeAt(secret, step + 1), now + 30_000), null);
  await db.update(adminUser).set({ mfaEnabled: true }).where(eq(adminUser.id, id));
  ok("a role change applies at once; without MFA there is no sign-in and no session (US-087 AC2)");

  await db.update(adminSession).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(adminSession.adminId, id));
  assert.equal(await staffFor(token), null);
  await db.update(adminSession).set({ expiresAt: new Date(Date.now() + 60_000) }).where(eq(adminSession.adminId, id));
  await signOutStaff(token);
  assert.equal(await staffFor(token), null);
  ok("a session ends when it runs out, and at sign-out");

  const trail = (await readAudit({ what: id })).map((row) => row.action).sort();
  assert.deepEqual(trail, ["create", "sign_in", "sign_out"]);
  assert.equal((await readAudit({ who: "OWNER@staff.statix" })).length, 2, "who: part of the email, any case");
  assert.equal((await readAudit({ who: "%" })).length, 0, "% is just a character");
  assert.equal((await readAudit({ what: id, before: new Date(Date.now() - 3_600_000) })).length, 0);
  const refused = (error: { cause?: { message?: string } }) => /append-only/.test(error.cause?.message ?? "");
  await assert.rejects(db.update(auditLog).set({ action: "edited" }).where(eq(auditLog.entityId, id)), refused);
  await assert.rejects(db.delete(auditLog).where(eq(auditLog.entityId, id)), refused);
  await assert.rejects(db.execute(sql`truncate audit_log`), refused);
  ok("sign-in and out are logged, filters work, and the database refuses to edit or delete the log");
}

main()
  .then(() => console.log("Staff check passed"), (error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await cleanUp(); process.exit(process.exitCode ?? 0); });
