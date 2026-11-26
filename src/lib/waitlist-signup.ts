// A signup from either form: the landing's (through /api/waitlist) or the panel's (through a server action).
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { normalizeEmail } from "./auth-rules";
import { formatDateTime } from "./format";
import { getDrop } from "./catalogue";
import { allow } from "./rate-limit";
import { appUrl, canEmail, sendEmail } from "./senders";
import { manageToken } from "./manage-token";
import { currentDropId, issueLink, join } from "./waitlist";
import { cleanSource, LINK_DAYS } from "./waitlist-rules";

/** `error` is a message key under "signup". */
export type SignupResult = { ok: true } | { ok: false; error: "invalid" | "needConsent" | "rateLimited" | "unavailable" };
export type SignupInput = { email?: unknown; consent?: unknown; marketing?: unknown; source?: unknown };

const HOUR = 60 * 60;

export async function signUp(input: SignupInput, ip: string): Promise<SignupResult> {
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  if (!email) return { ok: false, error: "invalid" };
  if (input.consent !== true) return { ok: false, error: "needConsent" };
  const drop = await currentDropId();
  if (!drop || !canEmail()) return { ok: false, error: "unavailable" };
  if (!(await allow(`waitlist:ip:${ip}`, 10, HOUR)) || !(await allow(`waitlist:${email}`, 3, HOUR))) return { ok: false, error: "rateLimited" };

  const { entry, outcome } = await join(email, drop.id, input.marketing === true, cleanSource(input.source));
  const t = await getTranslations("mail");
  const base = appUrl();
  // sent after the response, so how long it takes says nothing about whether the address was already listed
  after(async () => {
    if (outcome === "already") await sendEmail(email, t("waitlistAlready.subject", { drop: drop.name }), t("waitlistAlready.body", { drop: drop.name, manage: manageUrl(entry.id, base) }));
    else await sendConfirmLink(entry.id, email, drop.name, base);
  });
  return { ok: true };
}

export const manageUrl = (entryId: string, base = appUrl()) => `${base}/preferences/${manageToken(entryId)}`;

export async function sendConfirmLink(entryId: string, email: string, dropName: string, base = appUrl()) {
  const t = await getTranslations("mail");
  const url = `${base}/waitlist/confirm/${await issueLink(entryId)}`;
  await sendEmail(email, t("waitlistConfirm.subject", { drop: dropName }), t("waitlistConfirm.body", { drop: dropName, url, days: LINK_DAYS, manage: manageUrl(entryId, base) }));
}

/** FR-024: after confirming, what's true now and what happens next. */
export async function sendStatusEmail(entryId: string, email: string, dropName: string, base = appUrl()) {
  const t = await getTranslations("mail");
  const drop = await getDrop();
  const opens = drop?.earlyAccessAt ? formatDateTime(drop.earlyAccessAt) : "";
  await sendEmail(email, t("waitlistOn.subject", { drop: dropName }), t("waitlistOn.body", { drop: dropName, opens, manage: manageUrl(entryId, base) }));
}
