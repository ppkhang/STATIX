// A8, read only for now: finding orders, and the refunds that are owed. The role check is here, with the data, so
// no route to it can skip it. Relative imports, so scripts/check-payments.ts can run this outside Next.
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { account, customerOrder, dropRun, edition, editionUnit, orderLine, payment, refund } from "../db/schema";
import { toE164VN } from "./auth-rules";
import { findOrder } from "./orders";
import { can, type Staff } from "./staff";

export type OrderStatusFilter = (typeof customerOrder.status.enumValues)[number];
export type OrderFilter = { q?: string; status?: OrderStatusFilter; drop?: number; owed?: boolean };

const refundOwed = sql<number>`coalesce((select sum(r.amount_vnd) from ${refund} r join ${payment} p on p.id = r.payment_id
  where p.order_id = ${customerOrder.id} and r.status = 'pending'), 0)::int`;

/** Newest first. shortcut: the latest 100 that match; add paging when filters stop being enough. */
export async function searchOrders(actor: Staff, { q, status, drop, owed }: OrderFilter = {}) {
  if (!can(actor.role, "orders")) return null;
  // position(), so that % and _ in the box are just characters
  const contains = (column: unknown, text: string) => sql`position(lower(${text}) in lower(${column})) > 0`;
  const withLine = (extra: ReturnType<typeof sql>) => sql`exists (select 1 from ${orderLine} l
    join ${editionUnit} u on u.id = l.edition_unit_id join ${edition} e on e.id = u.edition_id
    join ${dropRun} d on d.id = e.drop_id where l.order_id = ${customerOrder.id} and ${extra})`;
  const phone = q ? toE164VN(q) : null;
  const term = q ? or(
    contains(customerOrder.orderNo, q),
    contains(account.email, q),
    phone ? sql`${customerOrder.shipTo}->>'receiverPhone' = ${phone} or ${account.phone} = ${phone}` : undefined,
    /^\d{1,5}$/.test(q) ? withLine(sql`u.number = ${Number(q)}`) : undefined,
  ) : undefined;

  return db.select({
    id: customerOrder.id, orderNo: customerOrder.orderNo, status: customerOrder.status, totalVnd: customerOrder.totalVnd,
    createdAt: customerOrder.createdAt, method: customerOrder.paymentMethod, email: account.email, owedVnd: refundOwed,
  }).from(customerOrder).innerJoin(account, eq(customerOrder.accountId, account.id))
    .where(and(
      term,
      status ? eq(customerOrder.status, status) : undefined,
      drop ? withLine(sql`d.number = ${drop}`) : undefined,
      owed ? sql`${refundOwed} > 0` : undefined,
    ))
    .orderBy(desc(customerOrder.createdAt)).limit(100);
}

export async function staffOrder(actor: Staff, orderNo: string) {
  if (!can(actor.role, "orders")) return null;
  const [found] = await db.select({ accountId: customerOrder.accountId, email: account.email }).from(customerOrder)
    .innerJoin(account, eq(customerOrder.accountId, account.id)).where(eq(customerOrder.orderNo, orderNo));
  if (!found) return null;
  const order = (await findOrder(found.accountId, orderNo))!;
  const payments = await db.select({
    id: payment.id, provider: payment.provider, status: payment.status, amountVnd: payment.amountVnd, createdAt: payment.createdAt,
  }).from(payment).where(eq(payment.orderId, order.id)).orderBy(asc(payment.createdAt));
  const owed = payments.length
    ? await db.select().from(refund).where(inArray(refund.paymentId, payments.map((row) => row.id))).orderBy(asc(refund.createdAt))
    : [];
  // a released line no longer claims its number: worth showing, so nobody ships it
  const released = (await db.select({ id: orderLine.id }).from(orderLine)
    .where(and(eq(orderLine.orderId, order.id), sql`not ${isNull(orderLine.releasedAt)}`))).map((row) => row.id);
  return { ...order, email: found.email, payments, owed, released };
}
