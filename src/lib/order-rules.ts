// Pure order rules, no database. Tested in order-rules.test.ts.
import type { orderStatus } from "../db/schema";

export type OrderStatus = (typeof orderStatus.enumValues)[number];

export type Step = { status: OrderStatus; state: "done" | "now" | "later" };

/**
 * The status timeline on page 14. Cash on delivery is "confirmed" where an online payment is "paid".
 * Cancelled and refunded orders left the line at a point nothing records, so they get no timeline.
 */
export function timeline(status: OrderStatus, method: "vnpay" | "momo" | "cod"): Step[] | null {
  if (status === "cancelled" || status === "refunded") return null;
  const second = method === "cod" ? "confirmed" : "paid";
  const steps: OrderStatus[] = ["pending", second, "packing", "shipped", "delivered", "completed"];
  // "paid" and "confirmed" are the same place on the line, whichever the order carries
  const at = steps.indexOf(status === "paid" || status === "confirmed" ? second : status);
  return steps.map((step, i) => ({ status: step, state: i < at ? "done" : i === at ? "now" : "later" }));
}
