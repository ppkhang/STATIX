// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { base32, codeAt, fromBase32, matchStep } from "./totp";

// RFC 6238 appendix B, SHA-1 key; the RFC prints 8 digits and an app shows the last 6
const SECRET = base32(Buffer.from("12345678901234567890"));

test("codes match the RFC's test values", () => {
  assert.equal(SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(fromBase32(SECRET).toString(), "12345678901234567890");
  for (const [seconds, code] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]] as const) {
    assert.equal(codeAt(SECRET, Math.floor(seconds / 30)), code, String(seconds));
  }
});

test("a code allows one step of drift, and works once", () => {
  const now = 1_000_000 * 30_000;
  for (const drift of [-1, 0, 1]) assert.equal(matchStep(SECRET, codeAt(SECRET, 1_000_000 + drift), now, null), 1_000_000 + drift);
  for (const drift of [-2, 2]) assert.equal(matchStep(SECRET, codeAt(SECRET, 1_000_000 + drift), now, null), null);
  assert.equal(matchStep(SECRET, codeAt(SECRET, 1_000_000), now, 1_000_000), null, "used");
  assert.equal(matchStep(SECRET, codeAt(SECRET, 999_999), now, 1_000_000), null, "older than the used one");
  assert.equal(matchStep(SECRET, codeAt(SECRET, 1_000_001), now, 1_000_000), 1_000_001);
  for (const bad of ["", "12345", "1234567", "abcdef"]) assert.equal(matchStep(SECRET, bad, now, null), null);
});
