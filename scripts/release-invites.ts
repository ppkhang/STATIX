// Releases early-access invites to confirmed people on a drop's waitlist (PRC-02), until the admin pages exist (M6).
// Run: npm run invites:release -- --drop 1 [--limit 50] [--dry-run]
// With no email key it prints each email to this terminal; with RESEND_API_KEY and EMAIL_FROM it really sends.
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { dropRun } from "../src/db/schema";
import { formatDateTime } from "../src/lib/format";
import { inviteExpiry } from "../src/lib/invite-rules";
import { awaitingInvite, issueInvite } from "../src/lib/invites";
import { makeManageToken } from "../src/lib/manage-token";
import { appUrl, canEmail, sendEmail } from "../src/lib/senders";

const flag = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
};

async function main() {
  const number = Number(flag("drop"));
  const limit = flag("limit") === undefined ? undefined : Number(flag("limit"));
  if (!Number.isInteger(number) || (limit !== undefined && !(Number.isInteger(limit) && limit > 0))) {
    throw new Error("Usage: npm run invites:release -- --drop 1 [--limit 50] [--dry-run]");
  }
  const [drop] = await db.select().from(dropRun).where(eq(dropRun.number, number));
  if (!drop || drop.state === "draft" || drop.state === "closed") throw new Error(`Drop ${number} isn't open for invites`);
  const expires = inviteExpiry(drop.publicAt, new Date());
  if (!expires) throw new Error("The public opening has passed: there is no head start left to invite anyone to");

  const people = await awaitingInvite(drop.id, limit);
  console.log(`${drop.name}: ${people.length} confirmed ${people.length === 1 ? "person" : "people"} waiting for an invite`);
  if (process.argv.includes("--dry-run") || people.length === 0) return;
  // checked before any invite is made, so nobody is marked invited without an email going out
  if (!canEmail()) throw new Error("No way to send email: set RESEND_API_KEY and EMAIL_FROM");
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const base = appUrl();
  const mail = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8")).mail.invite as { subject: string; body: string };
  const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

  let sent = 0;
  for (const person of people) {
    const token = await issueInvite(person.id, expires);
    const values = { drop: drop.name, url: `${base}/invite/${token}`, expires: formatDateTime(expires.toISOString()), manage: `${base}/preferences/${makeManageToken(person.id, secret)}` };
    try {
      await sendEmail(person.email, fill(mail.subject, values), fill(mail.body, values));
      sent++;
    } catch (error) {
      // they stay "invited": "Send me a new link" on an expired invite, or deleting the invite row, puts them right
      console.error(`Could not email one invite: ${(error as Error).message}`);
    }
  }
  console.log(`Sent ${sent} of ${people.length}`);
}

main().then(() => process.exit(0), (error) => { console.error(error.message); process.exit(1); });
