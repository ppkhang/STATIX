// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { detailsProblem, editionProblem, fromVietnamInput, salesStarted, scheduleProblem, toVietnamInput } from "./drop-admin-rules";

const at = (time: string) => new Date(`2026-12-20T${time}:00+07:00`);
const good = { name: "Drop 002", earlyAccessAt: at("19:30"), publicAt: at("20:00"), closeAt: at("23:00") };

test("a drop is fixed from its first opening", () => {
  assert.equal(salesStarted({ ...good, state: "scheduled" }, at("19:29")), false);
  assert.equal(salesStarted({ ...good, state: "scheduled" }, at("19:30")), true);
  assert.equal(salesStarted({ ...good, state: "draft" }, at("21:00")), false, "a draft was never on sale");
  assert.equal(salesStarted({ ...good, state: "closed" }, at("10:00")), true);
});

test("times have to be in order, and ahead when scheduling", () => {
  assert.equal(scheduleProblem(good, at("10:00")), null);
  assert.equal(scheduleProblem({ ...good, earlyAccessAt: null, closeAt: null }, at("10:00")), null);
  assert.equal(scheduleProblem({ ...good, publicAt: null }, at("10:00")), "noPublicTime");
  assert.equal(scheduleProblem(good, at("19:30")), "inThePast");
  assert.equal(detailsProblem({ ...good, earlyAccessAt: at("20:00") }), "earlyAfterPublic");
  assert.equal(detailsProblem({ ...good, closeAt: at("20:00") }), "closeBeforePublic");
  assert.equal(detailsProblem({ ...good, name: "" }), "badName");
  assert.equal(detailsProblem({ ...good, publicAt: new Date(Number.NaN) }), "badTime");
});

test("edition numbers are whole and within limits", () => {
  const terms = { size: 500, priceVnd: 5_190_000, perPersonCap: 1 };
  assert.equal(editionProblem(terms), null);
  for (const size of [0, -1, 1.5, 10_001, Number.NaN]) assert.equal(editionProblem({ ...terms, size }), "badSize", String(size));
  assert.equal(editionProblem({ ...terms, priceVnd: 0 }), "badPrice");
  assert.equal(editionProblem({ ...terms, perPersonCap: 11 }), "badCap");
});

test("typed times are Vietnam time", () => {
  assert.equal(fromVietnamInput("2026-12-20T20:00")?.toISOString(), "2026-12-20T13:00:00.000Z");
  assert.equal(toVietnamInput(at("20:00")), "2026-12-20T20:00");
  assert.equal(fromVietnamInput(""), null);
  assert.ok(Number.isNaN(fromVietnamInput("tomorrow")!.getTime()));
});
