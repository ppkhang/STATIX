// Reading your own orders (page 14). Every query is scoped to the account: an order number alone shows nothing.
// Relative imports, so scripts/check-account.ts can run this outside Next.
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { customerOrder, dropRun, edition, editionUnit, orderLine, payment, product, refund, shipment, variant } from "../db/schema";

async function linesOf(orderIds: string[]) {
  if (!orderIds.length) return [];
  return db.select({
    id: orderLine.id, orderId: orderLine.orderId, priceVnd: orderLine.priceVnd, number: editionUnit.number,
    size: edition.size, name: product.name, colour: variant.colour, drop: dropRun.name,
  }).from(orderLine)
    .innerJoin(editionUnit, eq(orderLine.editionUnitId, editionUnit.id))
    .innerJoin(edition, eq(editionUnit.editionId, edition.id))
    .innerJoin(dropRun, eq(edition.dropId, dropRun.id))
    .innerJoin(variant, eq(edition.variantId, variant.id))
    .innerJoin(product, eq(variant.productId, product.id))
    .where(inArray(orderLine.orderId, orderIds))
    .orderBy(asc(product.sort), asc(editionUnit.number));
}

/** Newest first. shortcut: no paging; add it when one account can have more than a screenful of orders. */
export async function listOrders(accountId: string) {
  const orders = await db.select().from(customerOrder).where(eq(customerOrder.accountId, accountId)).orderBy(desc(customerOrder.createdAt));
  const lines = await linesOf(orders.map((order) => order.id));
  return orders.map((order) => ({ ...order, lines: lines.filter((line) => line.orderId === order.id) }));
}

export async function findOrder(accountId: string, orderNo: string) {
  const [order] = await db.select().from(customerOrder)
    .where(and(eq(customerOrder.accountId, accountId), eq(customerOrder.orderNo, orderNo)));
  if (!order) return null;
  const shipments = await db.select().from(shipment).where(eq(shipment.orderId, order.id)).orderBy(asc(shipment.createdAt));
  const refunds = await db.select({ id: refund.id, amountVnd: refund.amountVnd, status: refund.status }).from(refund)
    .innerJoin(payment, eq(refund.paymentId, payment.id)).where(eq(payment.orderId, order.id)).orderBy(asc(refund.createdAt));
  return { ...order, lines: await linesOf([order.id]), shipments, refunds };
}
