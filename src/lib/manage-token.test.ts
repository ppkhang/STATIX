// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeManageToken, readManageToken } from "./manage-token";

const ID = "3f2b8c1a-9d4e-4f7a-b2c6-0a1d5e8f9b3c";
const OTHER = "11111111-2222-4333-8444-555555555555";

test("a manage link names its entry only with this site's signature", () => {
  const token = makeManageToken(ID, "secret-a");
  assert.equal(readManageToken(token, "secret-a"), ID);
  assert.equal(readManageToken(token, "secret-b"), null);
  // someone else's id with a signature lifted from another link
  assert.equal(readManageToken(`${OTHER}.${token.split(".")[1]}`, "secret-a"), null);
  for (const junk of ["", ID, `${ID}.`, `${ID}.x`, `${token}.y`, `not-an-id.${token.split(".")[1]}`]) assert.equal(readManageToken(junk, "secret-a"), null);
});
