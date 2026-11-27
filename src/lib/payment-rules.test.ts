// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { isOnlineMethod, mockPaymentsOn } from "./payment-rules";

test("the mock is off unless asked for, and stays off on a real host", () => {
  const prod = { NODE_ENV: "production", PAYMENT_MOCK: "1" };
  assert.equal(mockPaymentsOn({ NODE_ENV: "development" }), false);
  assert.equal(mockPaymentsOn({ NODE_ENV: "development", PAYMENT_MOCK: "0" }), false);
  assert.equal(mockPaymentsOn({ NODE_ENV: "development", PAYMENT_MOCK: "1" }), true);
  assert.equal(mockPaymentsOn({ ...prod, APP_URL: "http://localhost:3100" }), true);
  for (const url of [undefined, "", "nonsense", "https://statix.vn", "https://localhost.statix.vn", "https://statix.vn/localhost"]) {
    assert.equal(mockPaymentsOn({ ...prod, APP_URL: url }), false, String(url));
  }
});

test("only the online methods are accepted", () => {
  assert.ok(isOnlineMethod("vnpay") && isOnlineMethod("momo"));
  assert.ok(!isOnlineMethod("cod") && !isOnlineMethod("") && !isOnlineMethod("stripe"));
});
