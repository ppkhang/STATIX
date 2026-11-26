// The "manage my data" link in waitlist emails: the entry's id, signed. Nothing is stored; deleting the entry is
// what stops the link working. It never expires on purpose: leaving and deleting must stay one click away (FR-026).
import { createHmac, timingSafeEqual } from "node:crypto";

const sign = (entryId: string, secret: string) => createHmac("sha256", secret).update(`waitlist-manage:${entryId}`).digest("base64url");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const makeManageToken = (entryId: string, secret: string) => `${entryId}.${sign(entryId, secret)}`;

/** The entry id if this site signed the token, otherwise null. */
export function readManageToken(token: string, secret: string): string | null {
  const [entryId, signature, extra] = token.split(".");
  if (extra !== undefined || !signature || !UUID.test(entryId)) return null;
  const expected = Buffer.from(sign(entryId, secret));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? entryId : null;
}

function secret(): string {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set");
  return process.env.AUTH_SECRET;
}
export const manageToken = (entryId: string) => makeManageToken(entryId, secret());
export const entryFromToken = (token: string) => readManageToken(token, secret());
