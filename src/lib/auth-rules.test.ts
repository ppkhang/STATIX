// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeEmail, passwordOk, safeNext, tierOnVerify, toE164VN } from "./auth-rules";
import { hashPassword, verifyPassword } from "./password";

test("emails are trimmed and lowercased", () => {
  assert.equal(normalizeEmail("  Minh@Example.COM "), "minh@example.com");
  for (const bad of ["", "minh", "a@b", "a b@c.com", `${"a".repeat(250)}@b.com`]) assert.equal(normalizeEmail(bad), null);
});

test("Vietnamese mobiles become +84", () => {
  for (const raw of ["0912 345 678", "+84 912.345.678", "84912345678"]) assert.equal(toE164VN(raw), "+84912345678");
  for (const bad of ["0212345678", "091234567", "09123456789", "+1 555 000 1111", "abc"]) assert.equal(toE164VN(bad), null);
});

test("password length", () => {
  assert.equal(passwordOk("a".repeat(11)), false);
  assert.equal(passwordOk("a".repeat(12)), true);
  assert.equal(passwordOk("a".repeat(129)), false);
});

test("next must stay on this site", () => {
  assert.equal(safeNext("/drop/001?x=1", "/account"), "/drop/001?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "/\n/evil.com", undefined, ["/a"]]) {
    assert.equal(safeNext(bad, "/account"), "/account");
  }
});

test("tier on verify", () => {
  assert.equal(tierOnVerify("visitor", true), "waitlist");
  assert.equal(tierOnVerify("visitor", false), "member");
  assert.equal(tierOnVerify("founder", false), "founder");
});

test("passwords hash with argon2id and verify", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.match(stored, /^argon2id\$19456\$2\$1\$/);
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("correct horse batterY", stored), false);
  assert.equal(await verifyPassword("anything at all here", null), false);
});
