// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { dropStatus, editionState } from "./drop-status";

const at = (time: string) => new Date(`2026-12-20T${time}:00+07:00`);
const drop = { state: "scheduled", earlyAccessAt: at("19:30"), publicAt: at("20:00"), closeAt: at("23:00") };

test("state follows the server clock", () => {
  assert.deepEqual(dropStatus(drop, at("19:29"), 5), { state: "scheduled", nextAt: drop.earlyAccessAt });
  assert.deepEqual(dropStatus(drop, at("19:30"), 5), { state: "early_access", nextAt: drop.publicAt });
  assert.deepEqual(dropStatus(drop, at("20:00"), 5), { state: "public", nextAt: drop.closeAt });
  assert.deepEqual(dropStatus(drop, at("23:00"), 5), { state: "closed", nextAt: null });
});

test("sold out only once selling has started", () => {
  assert.equal(dropStatus(drop, at("19:00"), 0)?.state, "scheduled");
  assert.equal(dropStatus(drop, at("19:45"), 0)?.state, "sold_out");
  assert.equal(dropStatus(drop, at("21:00"), 0)?.state, "sold_out");
  assert.equal(editionState("public", 0), "sold_out");
  assert.equal(editionState("scheduled", 0), "scheduled");
  assert.equal(editionState("public", 3), "public");
});

test("no early-access window goes straight to public", () => {
  const plain = { ...drop, earlyAccessAt: null };
  assert.deepEqual(dropStatus(plain, at("19:45"), 5), { state: "scheduled", nextAt: drop.publicAt });
  assert.equal(dropStatus(plain, at("20:00"), 5)?.state, "public");
});

test("the column can hide or close a drop", () => {
  assert.equal(dropStatus({ ...drop, state: "draft" }, at("21:00"), 5), null);
  assert.equal(dropStatus({ ...drop, state: "closed" }, at("19:00"), 5)?.state, "closed");
});
