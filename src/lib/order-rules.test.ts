// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { timeline } from "./order-rules";

const marks = (...args: Parameters<typeof timeline>) => timeline(...args)?.map((s) => `${s.status}:${s.state}`);

test("the timeline marks where the order is", () => {
  assert.deepEqual(marks("packing", "momo"), ["pending:done", "paid:done", "packing:now", "shipped:later", "delivered:later", "completed:later"]);
  assert.deepEqual(marks("confirmed", "cod")?.slice(0, 3), ["pending:done", "confirmed:now", "packing:later"]);
  assert.equal(marks("paid", "cod")?.[1], "confirmed:now");
  assert.equal(marks("pending", "vnpay")?.[0], "pending:now");
});

test("cancelled and refunded orders have no timeline", () => {
  assert.equal(timeline("cancelled", "cod"), null);
  assert.equal(timeline("refunded", "vnpay"), null);
});
