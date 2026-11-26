// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanInterests, cleanSource, onJoin } from "./waitlist-rules";

test("one entry per address: what a repeat signup does", () => {
  assert.equal(onJoin(undefined), "create");
  assert.equal(onJoin("left"), "restart");
  assert.equal(onJoin("pending"), "relink");
  for (const status of ["confirmed", "invited"]) assert.equal(onJoin(status), "already");
});

test("only campaign tags are kept as the source", () => {
  assert.deepEqual(cleanSource({ utm_source: " ig ", utm_medium: "story", email: "a@b.com", fbclid: "x" }), { utm_source: "ig", utm_medium: "story" });
  assert.equal(cleanSource({ utm_source: "x".repeat(500) })!.utm_source.length, 100);
  for (const nothing of [null, "utm_source=ig", {}, { utm_source: 7 }, { utm_source: "  " }]) assert.equal(cleanSource(nothing), null);
});

test("interests are limited to real products, once each", () => {
  assert.deepEqual(cleanInterests(["wire", "wire", "nope", "signal"], ["static-one", "signal", "stand", "wire"]), ["signal", "wire"]);
});
