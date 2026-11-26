// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { inviteExpiry, inviteView } from "./invite-rules";

const now = new Date("2026-12-20T12:00:00Z");
const later = new Date("2026-12-20T13:00:00Z");
const earlier = new Date("2026-12-20T11:00:00Z");

test("an invite lasts until the public opening", () => {
  assert.equal(inviteExpiry(later, now), later);
  assert.equal(inviteExpiry(earlier, now), null);
  assert.equal(inviteExpiry(null, now)!.getTime() - now.getTime(), 72 * 3_600_000);
});

test("only the invited, proven account can accept", () => {
  const open = { usedAt: null, accountId: null, expiresAt: later };
  const entry = { emailNorm: "ada@example.com", status: "invited" };
  const ada = { id: "a", email: "ada@example.com", emailVerified: true };
  assert.equal(inviteView(open, entry, ada, now), "ready");
  assert.equal(inviteView(open, entry, null, now), "signedOut");
  assert.equal(inviteView(open, entry, { ...ada, emailVerified: false }, now), "unverified");
  assert.equal(inviteView(open, entry, { id: "b", email: "bo@example.com", emailVerified: true }, now), "wrongAccount");
  assert.equal(inviteView({ ...open, expiresAt: earlier }, entry, ada, now), "expired");
  assert.equal(inviteView(open, { ...entry, status: "left" }, ada, now), "left");
});

test("a used invite is only 'yours' to the account that used it", () => {
  const used = { usedAt: earlier, accountId: "a", expiresAt: earlier };
  const entry = { emailNorm: "ada@example.com", status: "invited" };
  assert.equal(inviteView(used, entry, { id: "a", email: "ada@example.com", emailVerified: true }, now), "yours");
  assert.equal(inviteView(used, entry, { id: "b", email: "bo@example.com", emailVerified: true }, now), "used");
  assert.equal(inviteView(used, entry, null, now), "used");
  assert.equal(inviteView({ ...used, accountId: null }, entry, null, now), "used");
});
