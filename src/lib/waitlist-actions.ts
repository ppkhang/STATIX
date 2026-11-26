"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { toE164VN } from "./auth-rules";
import { allow, clientIp } from "./rate-limit";
import { canEmail } from "./senders";
import * as waitlist from "./waitlist";
import { cleanInterests } from "./waitlist-rules";
import { sendConfirmLink, sendStatusEmail, signUp, type SignupInput, type SignupResult } from "./waitlist-signup";

const HOUR = 60 * 60;
const page = (token: string, query = "") => `/waitlist/confirm/${encodeURIComponent(token)}${query}`;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

/** The signup panel on the product and Drop pages. */
export async function joinFromPanel(input: SignupInput): Promise<SignupResult> {
  return signUp(input, clientIp(await headers()));
}

/** Sent by the confirm page itself once it has loaded in a browser: opening the link alone changes nothing. */
export async function confirmEntry(form: FormData) {
  const token = field(form, "token");
  if (await waitlist.confirm(token)) {
    const found = await waitlist.findLink(token);
    if (found) after(() => sendStatusEmail(found.entry.id, found.entry.email, found.drop));
  }
  redirect(page(token)); // the page reads the link again and shows what's true now
}

/** From an expired link: the same address gets a fresh one. */
export async function sendNewLink(form: FormData) {
  const token = field(form, "token");
  const found = await waitlist.findLink(token);
  if (found && found.entry.status === "pending" && canEmail()) {
    const ok = (await allow(`waitlist-relink:ip:${clientIp(await headers())}`, 10, HOUR)) && (await allow(`waitlist:${found.entry.emailNorm}`, 3, HOUR));
    if (!ok) redirect(page(token, "?again=limited"));
    after(() => sendConfirmLink(found.entry.id, found.entry.email, found.drop));
    redirect(page(token, "?again=sent"));
  }
  redirect(page(token));
}

export type DetailsState = { saved?: boolean; error?: "badPhone" | "gone" };

/** Optional extras on the confirm page: which products, and a phone or Zalo number (FR-021). */
export async function saveDetails(_state: DetailsState, form: FormData): Promise<DetailsState> {
  const found = await waitlist.findLink(field(form, "token"));
  // the link must be the confirmed one, still inside its week
  if (!found?.link.usedAt || found.link.expiresAt < new Date() || found.entry.status !== "confirmed") return { error: "gone" };
  const raw = field(form, "phone").trim();
  const phone = raw ? toE164VN(raw) : null;
  if (raw && !phone) return { error: "badPhone" };
  const known = (await waitlist.dropProducts(found.entry.dropId!)).map((p) => p.slug);
  await waitlist.saveDetails(found.entry.id, cleanInterests(form.getAll("interest").map(String), known), phone);
  return { saved: true };
}
