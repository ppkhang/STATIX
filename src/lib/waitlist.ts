// Waitlist entries and their one-time double opt-in links (FR-021 to FR-024).
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dropRun, edition, product, variant, waitlistEntry, waitlistLink } from "@/db/schema";
import { getDrop } from "./catalogue";
import { LINK_DAYS, onJoin } from "./waitlist-rules";

export type Entry = typeof waitlistEntry.$inferSelect;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** The drop a signup is for. shortcut: a sold-out drop still takes them, until a next drop exists to attach to. */
export async function currentDropId(): Promise<{ id: string; number: number; name: string } | null> {
  const snapshot = await getDrop();
  if (!snapshot) return null;
  const [row] = await db.select({ id: dropRun.id }).from(dropRun).where(eq(dropRun.number, snapshot.number));
  return row ? { id: row.id, number: snapshot.number, name: snapshot.name } : null;
}

/**
 * Adds or refreshes the one entry for this address and drop. Says what happened, for choosing the email; the
 * visitor is never told, so the form can't be used to find out who is on the list.
 */
export async function join(email: string, dropId: string, marketing: boolean, source: Record<string, string> | null) {
  const created = await db.insert(waitlistEntry)
    .values({ email, emailNorm: email, dropId, marketingConsent: marketing, consentAt: new Date(), source })
    .onConflictDoNothing().returning();
  if (created[0]) return { entry: created[0], outcome: "create" as const };

  const [entry] = await db.select().from(waitlistEntry).where(and(eq(waitlistEntry.emailNorm, email), eq(waitlistEntry.dropId, dropId)));
  const outcome = onJoin(entry.status);
  if (outcome === "restart" || outcome === "relink") {
    await db.update(waitlistEntry)
      .set({ status: "pending", marketingConsent: marketing, consentAt: new Date(), confirmedAt: null, source: source ?? entry.source })
      .where(eq(waitlistEntry.id, entry.id));
  }
  return { entry, outcome };
}

/** A new link replaces any earlier unused one. */
export async function issueLink(entryId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.delete(waitlistLink).where(and(eq(waitlistLink.entryId, entryId), isNull(waitlistLink.usedAt)));
    await tx.insert(waitlistLink)
      .values({ entryId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LINK_DAYS * 86_400_000) });
  });
  return token;
}

/** The link and its entry, used or expired included, so the page can say which it is. Reading changes nothing. */
export async function findLink(token: string) {
  const [row] = await db.select({ link: waitlistLink, entry: waitlistEntry, drop: dropRun.name }).from(waitlistLink)
    .innerJoin(waitlistEntry, eq(waitlistLink.entryId, waitlistEntry.id))
    .innerJoin(dropRun, eq(waitlistEntry.dropId, dropRun.id))
    .where(eq(waitlistLink.tokenHash, sha256(token)));
  return row;
}

/** Uses the link once and confirms the entry. Null if the link was already used, has expired, or isn't one. */
export async function confirm(token: string): Promise<Entry | null> {
  return db.transaction(async (tx) => {
    const [used] = await tx.update(waitlistLink).set({ usedAt: new Date() })
      .where(and(eq(waitlistLink.tokenHash, sha256(token)), isNull(waitlistLink.usedAt), gt(waitlistLink.expiresAt, new Date())))
      .returning({ entryId: waitlistLink.entryId });
    if (!used) return null;
    const [entry] = await tx.update(waitlistEntry).set({ status: "confirmed", confirmedAt: new Date() })
      .where(and(eq(waitlistEntry.id, used.entryId), eq(waitlistEntry.status, "pending"))).returning();
    return entry ?? null;
  });
}

export async function saveDetails(entryId: string, interests: string[], phone: string | null) {
  await db.update(waitlistEntry).set({ interests, phone }).where(eq(waitlistEntry.id, entryId));
}

/** The products in a drop, in catalogue order, for the interest chips. */
export async function dropProducts(dropId: string) {
  const rows = await db.select({ slug: product.slug, name: product.name }).from(edition)
    .innerJoin(variant, eq(edition.variantId, variant.id)).innerJoin(product, eq(variant.productId, product.id))
    .where(eq(edition.dropId, dropId)).orderBy(asc(product.sort));
  return [...new Map(rows.map((row) => [row.slug, row])).values()];
}
