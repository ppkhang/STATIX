// Staff accounts, their sessions, what each role may open, and the audit log (FR-087, FR-088, NFR-014).
// Staff are not customers: their own table, their own sessions, no Auth.js.
// Relative imports, so the scripts can run this outside Next.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { and, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { adminRole, adminSession, adminUser, auditLog } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import { base32, matchStep } from "./totp";

export type Role = (typeof adminRole.enumValues)[number];
export type Staff = { id: string; email: string; role: Role };

export const SESSION_HOURS = 8;

/** Who may open which admin page (PAGES_UI, "Admin"). A page that isn't listed here is open to nobody. */
const PAGE_ROLES = {
  home: adminRole.enumValues,
  audit: ["owner"],
  dashboard: ["owner", "ops"],
  drops: ["owner", "ops"],
  orders: ["owner", "ops", "fulfilment"],
} as const satisfies Record<string, readonly Role[]>;

export type AdminPage = keyof typeof PAGE_ROLES;
export const can = (role: Role, page: AdminPage) => (PAGE_ROLES[page] as readonly Role[]).includes(role);

type Writer = Pick<typeof db, "insert">;
type Change = { adminId: string | null; entity: string; entityId: string; action: string; oldValue?: unknown; newValue?: unknown; reason?: string };

/** Pass the transaction that makes the change, so neither happens without the other. */
export async function audit(change: Change, into: Writer = db) {
  await into.insert(auditLog).values(change);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// the authenticator secret is encrypted at rest: a copy of the database alone can't produce codes
function mfaKey() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", process.env.AUTH_SECRET, "", "statix-admin-mfa", 32));
}

function seal(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaKey(), iv);
  const sealed = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString("base64")).join(".");
}

function unseal(stored: string): string {
  const [iv, tag, sealed] = stored.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", mfaKey(), iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed), decipher.final()]).toString("utf8");
}

/** Makes a staff account with MFA already on. The secret is returned once, to put in an authenticator app. */
export async function createStaff(email: string, role: Role, password: string): Promise<{ id: string; secret: string }> {
  const secret = base32(randomBytes(20));
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const [made] = await tx.insert(adminUser)
      .values({ email: email.trim().toLowerCase(), role, passwordHash, mfaSecret: seal(secret), mfaEnabled: true })
      .returning({ id: adminUser.id });
    // made from the command line, so there is no signed-in staff member to name
    await audit({ adminId: null, entity: "admin_user", entityId: made.id, action: "create", newValue: { email, role } }, tx);
    return { id: made.id, secret };
  });
}

/**
 * Email, password and authenticator code together; every way of failing looks the same. Returns the session token
 * for the cookie (only its hash is stored), or null. An account without MFA can't sign in (US-087 AC2).
 */
export async function signInStaff(email: string, password: string, code: string, now = Date.now()): Promise<string | null> {
  const [row] = await db.select().from(adminUser).where(eq(adminUser.email, email.trim().toLowerCase()));
  if (!(await verifyPassword(password, row?.passwordHash)) || !row.mfaEnabled || !row.mfaSecret) return null;
  return db.transaction(async (tx) => {
    // locked, so the same code sent twice at once signs in once
    const [me] = await tx.select().from(adminUser).where(eq(adminUser.id, row.id)).for("update");
    const step = matchStep(unseal(me.mfaSecret!), code, now, me.totpLastStep);
    if (step === null) return null;
    await tx.update(adminUser).set({ totpLastStep: step }).where(eq(adminUser.id, me.id));
    const token = randomBytes(32).toString("base64url");
    await tx.insert(adminSession)
      .values({ adminId: me.id, tokenHash: sha256(token), expiresAt: sql`now() + make_interval(hours => ${SESSION_HOURS})` });
    await audit({ adminId: me.id, entity: "admin_user", entityId: me.id, action: "sign_in" }, tx);
    return token;
  });
}

/** Read fresh each time, so a role change or a removed MFA takes effect on the next click. */
export async function staffFor(token: string): Promise<Staff | null> {
  const [row] = await db.select({ id: adminUser.id, email: adminUser.email, role: adminUser.role }).from(adminSession)
    .innerJoin(adminUser, eq(adminSession.adminId, adminUser.id))
    .where(and(eq(adminSession.tokenHash, sha256(token)), gt(adminSession.expiresAt, sql`now()`), eq(adminUser.mfaEnabled, true)));
  return row ?? null;
}

export async function signOutStaff(token: string) {
  await db.transaction(async (tx) => {
    const [ended] = await tx.delete(adminSession).where(eq(adminSession.tokenHash, sha256(token))).returning({ adminId: adminSession.adminId });
    if (ended) await audit({ adminId: ended.adminId, entity: "admin_user", entityId: ended.adminId, action: "sign_out" }, tx);
  });
}

export type AuditFilter = { who?: string; what?: string; from?: Date; before?: Date };

/** Newest first. shortcut: the latest 200 that match; add paging when filters stop being enough. */
export async function readAudit({ who, what, from, before }: AuditFilter = {}) {
  // position(), so that % and _ in the box are just characters
  const contains = (column: unknown, text: string) => sql`position(lower(${text}) in lower(${column})) > 0`;
  return db.select({
    id: auditLog.id, at: auditLog.at, who: adminUser.email, entity: auditLog.entity, entityId: auditLog.entityId,
    action: auditLog.action, oldValue: auditLog.oldValue, newValue: auditLog.newValue, reason: auditLog.reason,
  }).from(auditLog).leftJoin(adminUser, eq(auditLog.adminId, adminUser.id))
    .where(and(
      who ? contains(adminUser.email, who) : undefined,
      what ? contains(sql`${auditLog.entity} || ' ' || ${auditLog.action} || ' ' || ${auditLog.entityId}`, what) : undefined,
      from ? gte(auditLog.at, from) : undefined,
      before ? lt(auditLog.at, before) : undefined,
    ))
    .orderBy(desc(auditLog.at)).limit(200);
}
