// The address book (page 16). Every query is scoped to the account, so an id on its own opens nothing.
// Relative imports, so scripts/check-account.ts can run this outside Next.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { address } from "../db/schema";
import type { Address } from "./checkout-rules";

export const MAX_ADDRESSES = 10;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One writer per account at a time, so there is never a second default or an address over the limit. */
async function locked<T>(accountId: string, work: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`address:${accountId}`}, 0))`);
    return work(tx);
  });
}

const own = (accountId: string, id: string) => and(eq(address.id, id), eq(address.accountId, accountId));

/** Default first. */
export async function listAddresses(accountId: string) {
  return db.select().from(address).where(eq(address.accountId, accountId)).orderBy(desc(address.isDefault), asc(address.recipient), asc(address.id));
}

/** `id` edits that address; without one a new address is added, and the first becomes the default. */
export async function writeAddress(accountId: string, value: Address, id?: string): Promise<"ok" | "gone" | "full"> {
  return locked(accountId, async (tx) => {
    if (id) {
      const changed = await tx.update(address).set(value).where(own(accountId, id)).returning({ id: address.id });
      return changed.length ? "ok" : "gone";
    }
    const mine = await tx.select({ isDefault: address.isDefault }).from(address).where(eq(address.accountId, accountId));
    if (mine.length >= MAX_ADDRESSES) return "full";
    await tx.insert(address).values({ ...value, accountId, isDefault: !mine.some((row) => row.isDefault) });
    return "ok";
  });
}

export async function makeDefault(accountId: string, id: string): Promise<boolean> {
  return locked(accountId, async (tx) => {
    const [target] = await tx.select({ id: address.id }).from(address).where(own(accountId, id));
    if (!target) return false;
    await tx.update(address).set({ isDefault: sql`${address.id} = ${id}` }).where(eq(address.accountId, accountId));
    return true;
  });
}

/** Deleting the default hands the default to another address, so checkout still has one. */
export async function removeAddress(accountId: string, id: string): Promise<boolean> {
  return locked(accountId, async (tx) => {
    const [gone] = await tx.delete(address).where(own(accountId, id)).returning({ isDefault: address.isDefault });
    if (!gone) return false;
    if (gone.isDefault) {
      const [next] = await tx.select({ id: address.id }).from(address).where(eq(address.accountId, accountId))
        .orderBy(asc(address.recipient), asc(address.id)).limit(1);
      if (next) await tx.update(address).set({ isDefault: true }).where(eq(address.id, next.id));
    }
    return true;
  });
}
