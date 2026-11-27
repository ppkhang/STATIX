// Makes a staff account with MFA on. Run: npm run staff:create -- --email you@example.com --role owner
// The password comes from STAFF_PASSWORD, or one is made up. Both it and the authenticator key are shown once.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { adminRole } from "../src/db/schema";
import { normalizeEmail, passwordOk } from "../src/lib/auth-rules";
import { createStaff, type Role } from "../src/lib/staff";

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, role: { type: "string" } } });
  const email = normalizeEmail(values.email ?? "");
  const role = values.role as Role;
  if (!email || !adminRole.enumValues.includes(role)) throw new Error(`Usage: --email <address> --role ${adminRole.enumValues.join("|")}`);
  const password = process.env.STAFF_PASSWORD || randomBytes(18).toString("base64url");
  if (!passwordOk(password)) throw new Error("STAFF_PASSWORD doesn't meet the password rule");
  const { secret } = await createStaff(email, role, password);
  console.log(`Staff account made: ${email} (${role})`);
  if (!process.env.STAFF_PASSWORD) console.log(`Password: ${password}`);
  console.log(`Authenticator key (add it as a time-based code): ${secret}`);
  console.log(`otpauth://totp/STATIX:${encodeURIComponent(email)}?secret=${secret}&issuer=STATIX`);
}

main().then(() => process.exit(0), (error) => { console.error(error.cause?.code === "23505" ? "That email already has a staff account" : error.message); process.exit(1); });
