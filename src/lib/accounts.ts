import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { account, authToken, phoneOtp, tier, waitlistEntry } from "@/db/schema";
import { tierOnVerify } from "./auth-rules";

export type Account = typeof account.$inferSelect;
export type Purpose = "verify" | "reset";

const TOKEN_MINUTES: Record<Purpose, number> = { verify: 24 * 60, reset: 60 };
const OTP_MINUTES = 5;
const OTP_TRIES = 5;
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60000);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function findByEmail(email: string): Promise<Account | undefined> {
  const [row] = await db.select().from(account).where(eq(account.email, email));
  return row;
}

export async function findById(id: string): Promise<Account | undefined> {
  const [row] = await db.select().from(account).where(eq(account.id, id));
  return row;
}

async function tierId(code: string): Promise<string> {
  const [row] = await db.select().from(tier).where(eq(tier.code, code));
  if (!row) throw new Error(`Tier ${code} is missing: run npm run db:seed`);
  return row.id;
}

/** Returns the new account, or null if the email is already taken. */
export async function createAccount(email: string, passwordHash: string | null): Promise<Account | null> {
  const [row] = await db.insert(account)
    .values({ email, passwordHash, tierId: await tierId("visitor") })
    .onConflictDoNothing().returning();
  return row ?? null;
}

/** Marks the email verified and moves a Visitor up a tier. */
export async function markVerified(row: Account): Promise<void> {
  const [current] = await db.select().from(tier).where(eq(tier.id, row.tierId));
  const [listed] = await db.select({ id: waitlistEntry.id }).from(waitlistEntry)
    .where(and(eq(waitlistEntry.emailNorm, row.email), eq(waitlistEntry.status, "confirmed"))).limit(1);
  await db.update(account)
    .set({ emailVerified: true, tierId: await tierId(tierOnVerify(current.code, Boolean(listed))) })
    .where(eq(account.id, row.id));
}

/** A new link replaces any earlier unused one of the same kind. */
export async function issueToken(accountId: string, purpose: Purpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.delete(authToken).where(and(eq(authToken.accountId, accountId), eq(authToken.purpose, purpose)));
    await tx.insert(authToken)
      .values({ accountId, purpose, tokenHash: sha256(token), expiresAt: inMinutes(TOKEN_MINUTES[purpose]) });
  });
  return token;
}

const liveToken = (token: string, purpose: Purpose) => and(
  eq(authToken.tokenHash, sha256(token)), eq(authToken.purpose, purpose),
  isNull(authToken.usedAt), gt(authToken.expiresAt, new Date()),
);

/** Reading a link never uses it up: mail scanners open links. */
export async function peekToken(token: string, purpose: Purpose): Promise<Account | undefined> {
  const [row] = await db.select({ account }).from(authToken)
    .innerJoin(account, eq(authToken.accountId, account.id)).where(liveToken(token, purpose));
  return row?.account;
}

/** Uses the link once. Two requests at the same moment can't both win. */
export async function useToken(token: string, purpose: Purpose): Promise<string | null> {
  const [row] = await db.update(authToken).set({ usedAt: new Date() })
    .where(liveToken(token, purpose)).returning({ accountId: authToken.accountId });
  return row?.accountId ?? null;
}

/** A reset also proves the email, ends old sessions and kills every other outstanding link. */
export async function setPassword(accountId: string, passwordHash: string): Promise<void> {
  await db.update(account).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(account.id, accountId));
  await db.delete(authToken).where(and(eq(authToken.accountId, accountId), isNull(authToken.usedAt)));
  const row = await findById(accountId);
  if (row) await markVerified(row);
}

/** For a Google sign-in whose address Google has verified. */
export async function accountForGoogle(email: string): Promise<Account> {
  const created = await createAccount(email, null);
  const row = created ?? (await findByEmail(email));
  if (!row) throw new Error("Google account could not be created");
  if (!row.emailVerified) {
    // Someone who registered this address without owning it must not keep a password that works.
    await db.update(account).set({ passwordHash: null, passwordChangedAt: new Date() }).where(eq(account.id, row.id));
    await db.delete(authToken).where(eq(authToken.accountId, row.id));
    await markVerified(row);
  }
  return (await findById(row.id))!;
}

const otpHash = (accountId: string, code: string) => {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", process.env.AUTH_SECRET).update(`${accountId}:${code}`).digest("hex");
};

/** Stores a fresh code (replacing older ones) and returns it for sending. */
export async function issueOtp(accountId: string, phone: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.transaction(async (tx) => {
    await tx.delete(phoneOtp).where(eq(phoneOtp.accountId, accountId));
    await tx.insert(phoneOtp)
      .values({ accountId, phone, codeHash: otpHash(accountId, code), expiresAt: inMinutes(OTP_MINUTES) });
  });
  return code;
}

export async function pendingOtp(accountId: string) {
  const [row] = await db.select().from(phoneOtp)
    .where(and(eq(phoneOtp.accountId, accountId), isNull(phoneOtp.usedAt),
      gt(phoneOtp.expiresAt, new Date()), lt(phoneOtp.attempts, OTP_TRIES)))
    .orderBy(desc(phoneOtp.expiresAt)).limit(1);
  return row;
}

export async function checkOtp(accountId: string, code: string): Promise<"ok" | "wrong" | "expired" | "taken"> {
  const pending = await pendingOtp(accountId);
  if (!pending) return "expired";
  // count the try before comparing, so parallel guesses can't share one
  const [counted] = await db.update(phoneOtp).set({ attempts: sql`${phoneOtp.attempts} + 1` })
    .where(and(eq(phoneOtp.id, pending.id), lt(phoneOtp.attempts, OTP_TRIES), isNull(phoneOtp.usedAt))).returning();
  if (!counted) return "expired";
  if (!timingSafeEqual(Buffer.from(otpHash(accountId, code)), Buffer.from(counted.codeHash))) return "wrong";
  await db.update(phoneOtp).set({ usedAt: new Date() }).where(eq(phoneOtp.id, counted.id));
  try {
    await db.update(account).set({ phone: counted.phone, phoneVerified: true }).where(eq(account.id, accountId));
  } catch (error) {
    // one phone per account (FR-015); only told to someone who proved they hold the phone
    const cause = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
    if (cause.code === "23505") return "taken";
    throw error;
  }
  return "ok";
}
