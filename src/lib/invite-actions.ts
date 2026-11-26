"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { currentAccount } from "@/auth";
import { formatDateTime } from "./format";
import { inviteExpiry, inviteView } from "./invite-rules";
import { acceptInvite, findInvite, issueInvite } from "./invites";
import { allow, clientIp } from "./rate-limit";
import { appUrl, canEmail, sendEmail } from "./senders";
import { manageUrl } from "./waitlist-signup";

const HOUR = 60 * 60;
const page = (token: string, query = "") => `/invite/${encodeURIComponent(token)}${query}`;
const dropPage = (number: number) => `/drop/${String(number).padStart(3, "0")}`;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

/** A button, not the page load: accepting spends the link. */
export async function accept(form: FormData) {
  const token = field(form, "token");
  const found = await findInvite(token);
  const me = await currentAccount();
  if (found && me && inviteView(found.invite, found.entry, me, new Date()) === "ready" && (await acceptInvite(token, me.id))) {
    redirect(dropPage(found.drop.number));
  }
  redirect(page(token)); // the page says why not
}

/** From an expired invite, while the head start is still on: the same address gets a new one. */
export async function sendNewInvite(form: FormData) {
  const token = field(form, "token");
  const found = await findInvite(token);
  const expires = found && inviteExpiry(found.drop.publicAt, new Date());
  if (!found || !expires || found.invite.usedAt || found.entry.status !== "invited" || found.invite.expiresAt > new Date() || !canEmail()) redirect(page(token));
  const ok = (await allow(`invite:ip:${clientIp(await headers())}`, 10, HOUR)) && (await allow(`invite:${found.entry.id}`, 3, HOUR));
  if (!ok) redirect(page(token, "?again=limited"));
  const t = await getTranslations("mail");
  const base = appUrl();
  const { entry, drop } = found;
  // The old row is kept as the thing this page is showing; the new one is added beside it and emailed.
  after(async () => {
    const fresh = await issueInvite(entry.id, expires, { keep: found.invite.id });
    await sendEmail(entry.emailNorm, t("invite.subject", { drop: drop.name }),
      t("invite.body", { drop: drop.name, url: `${base}/invite/${fresh}`, expires: formatDateTime(expires.toISOString()), manage: manageUrl(entry.id, base) }));
  });
  redirect(page(token, "?again=sent"));
}
