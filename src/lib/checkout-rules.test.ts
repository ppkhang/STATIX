// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanAddress, shippingEstimateVnd } from "./checkout-rules";

test("shipping estimate reads the province however it's typed", () => {
  for (const name of ["Hồ Chí Minh", "TP HCM", "ho chi minh city", "Sài Gòn"]) assert.equal(shippingEstimateVnd(name), 30_000, name);
  for (const name of ["Hà Nội", "hanoi"]) assert.equal(shippingEstimateVnd(name), 40_000, name);
  for (const name of ["Đà Nẵng", "Cần Thơ", ""]) assert.equal(shippingEstimateVnd(name), 50_000, name);
});

test("an address needs every field and a Vietnamese mobile", () => {
  const good = { recipient: " Ada  Nguyen ", receiverPhone: "0912 345 678", province: "Hà Nội", ward: "Ward 1", street: "1 Test Street" };
  assert.deepEqual(cleanAddress(good), { value: { ...good, recipient: "Ada Nguyen", receiverPhone: "+84912345678" } });
  assert.deepEqual(cleanAddress({ ...good, street: "  " }), { problem: "missing" });
  assert.deepEqual(cleanAddress({ ...good, receiverPhone: "123" }), { problem: "badPhone" });
  assert.deepEqual(cleanAddress({ ...good, ward: "x".repeat(121) }), { problem: "tooLong" });
});
