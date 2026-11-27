// Deleting an account (FR-026's promise extended to accounts; NFR-018). Orders are accounting records, so an
// account with any keeps its row with nothing in it that names the person.
// [ASSUMPTION] orders, with the delivery address saved on them, are kept; how long is still to be decided.
// Relative imports, so scripts/check-account.ts can run this outside Next.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { expireStaleOrders } from "./payments";
import { account, address, authToken, customerOrder, dropRun, edition, editionUnit, hold, orderLine, phoneOtp, waitlistEntry } from "../db/schema";

export type DeleteBlock = "openOrder" | "openDrop";

const FINISHED = ["completed", "cancelled", "refunded"];

type Reader = Pick<typeof db, "select">;

/** Why this account can't be deleted yet, or null. */
export async function deleteBlock(accountId: string, from: Reader = db): Promise<DeleteBlock | null> {
  const orders = await from.select({ status: customerOrder.status }).from(customerOrder).where(eq(customerOrder.accountId, accountId));
  if (orders.some((order) => !FINISHED.includes(order.status))) return "openOrder";
  // the per-person cap is counted by account (holds.ts): a new account with the same phone would get a second one
  const [stillSelling] = await from.select({ id: orderLine.id }).from(orderLine)
    .innerJoin(customerOrder, eq(orderLine.orderId, customerOrder.id))
    .innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id))
    .innerJoin(edition, eq(editionUnit.editionId, edition.id))
    .innerJoin(dropRun, eq(edition.dropId, dropRun.id))
    .where(and(eq(customerOrder.accountId, accountId), inArray(editionUnit.status, ["sold", "retired"]), isNull(orderLine.releasedAt),
      sql`${dropRun.state} <> 'closed' and (${dropRun.closeAt} is null or ${dropRun.closeAt} > now())`))
    .limit(1);
  return stillSelling ? "openDrop" : null;
}

/** The caller has already proved this is the account's owner. */
export async function deleteAccount(accountId: string): Promise<DeleteBlock | "deleted"> {
  await expireStaleOrders(accountId); // an abandoned payment isn't an order in progress
  return db.transaction(async (tx) => {
    // also keeps a new hold or order for this account waiting until this is done
    const [me] = await tx.select().from(account).where(eq(account.id, accountId)).for("update");
    if (!me) return "deleted";
    const blocked = await deleteBlock(accountId, tx);
    if (blocked) return blocked;

    const holds = (await tx.select({ id: hold.id }).from(hold).where(eq(hold.accountId, accountId))).map((row) => row.id);
    if (holds.length) {
      await tx.update(editionUnit).set({ status: "available", holdId: null, heldUntil: null })
        .where(and(inArray(editionUnit.holdId, holds), eq(editionUnit.status, "held")));
      await tx.update(editionUnit).set({ holdId: null, heldUntil: null }).where(inArray(editionUnit.holdId, holds));
      await tx.delete(hold).where(inArray(hold.id, holds));
    }
    // only for a proven address: an unverified account's email could be someone else's
    if (me.emailVerified) await tx.delete(waitlistEntry).where(eq(waitlistEntry.emailNorm, me.email));

    const [ordered] = await tx.select({ id: customerOrder.id }).from(customerOrder).where(eq(customerOrder.accountId, accountId)).limit(1);
    if (!ordered) {
      await tx.delete(account).where(eq(account.id, accountId)); // addresses, links and codes go with it
      return "deleted";
    }
    await tx.delete(address).where(eq(address.accountId, accountId));
    await tx.delete(authToken).where(eq(authToken.accountId, accountId));
    await tx.delete(phoneOtp).where(eq(phoneOtp.accountId, accountId));
    await tx.update(account).set({
      email: `${accountId}@deleted.invalid`, emailVerified: false, phone: null, phoneVerified: false,
      passwordHash: null, passwordChangedAt: new Date(), // ends every session
    }).where(eq(account.id, accountId));
    return "deleted";
  });
}
