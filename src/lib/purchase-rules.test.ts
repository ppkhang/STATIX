// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { refusal, type Buyer } from "./purchase-rules";

const ready: Buyer = { emailVerified: true, phoneVerified: true, tier: "member", invited: false };

test("nobody buys before the drop opens or after it's over", () => {
  assert.equal(refusal("scheduled", { ...ready, invited: true, tier: "founder" }), "notOpen");
  assert.equal(refusal("closed", ready), "closed");
  assert.equal(refusal("sold_out", ready), "soldOut");
});

test("early access goes by invite, not by tier", () => {
  for (const tier of ["visitor", "waitlist", "member"]) assert.equal(refusal("early_access", { ...ready, tier }), "needInvite");
  assert.equal(refusal("early_access", { ...ready, invited: true }), null);
  assert.equal(refusal("early_access", { ...ready, tier: "founder" }), null);
});

test("public is open to any buyer with a proven email and phone", () => {
  assert.equal(refusal("public", ready), null);
  assert.equal(refusal("public", { ...ready, emailVerified: false }), "needEmail");
  assert.equal(refusal("public", { ...ready, phoneVerified: false }), "needPhone");
  assert.equal(refusal("early_access", { ...ready, invited: true, phoneVerified: false }), "needPhone");
});
