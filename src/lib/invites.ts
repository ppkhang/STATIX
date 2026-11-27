// Early-access invites: releasing, reading and accepting them (FR-025, page 7, PRC-02).
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNotNull, isNull, ne, notExists, sql } from "drizzle-orm";
import { db } from "../db";
import { account, dropRun, invite, tier, waitlistEntry } from "../db/schema";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Confirmed people on a drop's list who haven't been sent an invite yet, longest waiting first. */
export async function awaitingInvite(dropId: string, limit?: number) {
  const query = db.select({ id: waitlistEntry.id, email: waitlistEntry.emailNorm }).from(waitlistEntry)
    .where(and(eq(waitlistEntry.dropId, dropId), eq(waitlistEntry.status, "confirmed"),
      notExists(db.select({ one: sql`1` }).from(invite).where(eq(invite.entryId, waitlistEntry.id)))))
    .orderBy(asc(waitlistEntry.confirmedAt));
  return limit ? query.limit(limit) : query;
}

/** Whether this account has accepted an invite for this drop: what early access goes by. */
export async function invitedTo(accountId: string, dropId: string, from: Pick<typeof db, "select"> = db): Promise<boolean> {
  const [accepted] = await from.select({ id: invite.id }).from(invite)
    .innerJoin(waitlistEntry, eq(invite.entryId, waitlistEntry.id))
    .where(and(eq(invite.accountId, accountId), isNotNull(invite.usedAt), eq(waitlistEntry.dropId, dropId))).limit(1);
  return Boolean(accepted);
}

/** A new link replaces any earlier unused one (except `keep`). Returns the raw token for the email; only its hash is kept. */
export async function issueInvite(entryId: string, expiresAt: Date, { keep }: { keep?: string } = {}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.delete(invite).where(and(eq(invite.entryId, entryId), isNull(invite.usedAt), keep ? ne(invite.id, keep) : undefined));
    await tx.insert(invite).values({ entryId, tokenHash: sha256(token), expiresAt });
    await tx.update(waitlistEntry).set({ status: "invited" }).where(eq(waitlistEntry.id, entryId));
  });
  return token;
}

export async function findInvite(token: string) {
  const [row] = await db.select({ invite, entry: waitlistEntry, drop: dropRun }).from(invite)
    .innerJoin(waitlistEntry, eq(invite.entryId, waitlistEntry.id))
    .innerJoin(dropRun, eq(waitlistEntry.dropId, dropRun.id))
    .where(eq(invite.tokenHash, sha256(token)));
  return row;
}

/**
 * Uses the invite once, for this account, and makes it a Member (US-032). Two requests at the same moment can't
 * both win. The caller has already checked the account is the invited one.
 */
export async function acceptInvite(token: string, accountId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [used] = await tx.update(invite).set({ usedAt: new Date(), accountId })
      .where(and(eq(invite.tokenHash, sha256(token)), isNull(invite.usedAt), gt(invite.expiresAt, new Date())))
      .returning({ id: invite.id });
    if (!used) return false;
    const [mine] = await tx.select({ code: tier.code }).from(account).innerJoin(tier, eq(account.tierId, tier.id)).where(eq(account.id, accountId));
    if (mine.code !== "founder") {
      const [member] = await tx.select({ id: tier.id }).from(tier).where(eq(tier.code, "member"));
      await tx.update(account).set({ tierId: member.id }).where(eq(account.id, accountId));
    }
    return true;
  });
}
