"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import { formatVnd, unitNumber } from "./format";
import { findOrder } from "./orders";
import { isOnlineMethod, mockPaymentsOn } from "./payment-rules";
import { cancelOrder, confirmPayment, findPayment, startPayment, type Reported, type StartResult } from "./payments";
import { allow, clientIp } from "./rate-limit";
import { appUrl, canEmail, sendEmail } from "./senders";

export type PayState = { error?: Extract<StartResult, { ok: false }>["error"] | "agree" | "method" | "unavailable" | "rateLimited" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

/** "Pay": checks everything on the server, then sends the buyer to the provider. Only the mock exists so far. */
export async function pay(_state: PayState, form: FormData): Promise<PayState> {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/checkout");
  if (!mockPaymentsOn()) return { error: "unavailable" };
  if (form.get("agree") !== "on") return { error: "agree" }; // BRU-007
  const method = field(form, "method");
  if (!isOnlineMethod(method)) return { error: "method" };
  const key = field(form, "attempt");
  if (!UUID.test(key)) return { error: "badKey" };
  if (!(await allow(`pay:${me.id}`, 20, 600)) || !(await allow(`pay:ip:${clientIp(await headers())}`, 60, 600))) return { error: "rateLimited" };
  const started = await startPayment(me.id, method, key);
  if (!started.ok) return { error: started.error };
  redirect(`/pay/mock/${started.txn}`);
}

/**
 * The mock provider's three buttons. It stands where a real provider's signed notification will: the amount and the
 * account come from our own records, never from the form.
 */
export async function mockOutcome(form: FormData) {
  if (!mockPaymentsOn()) notFound();
  const me = await currentAccount();
  const txn = field(form, "txn");
  if (!me) redirect("/login?next=/checkout");
  const attempt = UUID.test(txn) ? await findPayment(me.id, txn) : null;
  const outcome = field(form, "outcome") as Reported;
  if (!attempt || !["success", "failed", "cancelled"].includes(outcome)) notFound();
  const orderPage = `/account/orders/${attempt.orderNo}`;
  // the buttons are only offered while it's open; a second press must not change a settled one
  if (attempt.status !== "pending") redirect(orderPage);

  const confirmed = await confirmPayment(txn, attempt.amountVnd, outcome);
  if (confirmed.result === "failed" || confirmed.result === "cancelled") redirect(`/checkout?pay=${confirmed.result}`);
  if (confirmed.result === "paid" && confirmed.first && canEmail()) await emailLater(me.id, me.email, attempt.orderNo);
  redirect(confirmed.result === "paid" ? `${orderPage}?placed=1` : orderPage);
}

export async function cancelMyOrder(form: FormData) {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/orders");
  const orderNo = field(form, "order").slice(0, 40);
  await cancelOrder(me.id, orderNo); // acts only on this account's own, unshipped order
  redirect(`/account/orders/${encodeURIComponent(orderNo)}`);
}

/** The order email (FR-052), sent after the response so a slow mail server can't hold up the confirmation. */
async function emailLater(accountId: string, to: string, orderNo: string) {
  const t = await getTranslations("mail");
  const url = `${appUrl()}/account/orders/${orderNo}`;
  after(async () => {
    const order = await findOrder(accountId, orderNo);
    if (!order) return;
    const items = order.lines.map((line) => `${line.name} (${line.colour}), No. ${unitNumber(line.number)} / ${unitNumber(line.size)}`).join("\n");
    await sendEmail(to, t("orderPaid.subject", { number: orderNo }), t("orderPaid.body", { number: orderNo, items, total: formatVnd(order.totalVnd), url }));
  });
}
