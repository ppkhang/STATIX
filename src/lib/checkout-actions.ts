"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentAccount } from "@/auth";
import { listAddresses, makeDefault, removeAddress, writeAddress } from "./addresses";
import { safeNext } from "./auth-rules";
import { cleanAddress, type AddressProblem } from "./checkout-rules";
import { extendHold, holdUnit, releaseHold, type HoldResult } from "./holds";
import { allow, clientIp } from "./rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

export type BuyState = { error?: Extract<HoldResult, { ok: false }>["error"] | "rateLimited" };

/** "Buy now": takes the hold and goes to checkout. Signed out goes to log in first, then back where they were. */
export async function buy(_state: BuyState, form: FormData): Promise<BuyState> {
  const me = await currentAccount();
  if (!me) redirect(`/login?next=${encodeURIComponent(safeNext(form.get("from"), "/drop/001"))}`);
  const editionId = field(form, "edition");
  if (!UUID.test(editionId)) return { error: "unknown" };
  // NFR-013: holds are what a bot would hammer
  if (!(await allow(`hold:${me.id}`, 20, 600)) || !(await allow(`hold:ip:${clientIp(await headers())}`, 60, 600))) return { error: "rateLimited" };
  const result = await holdUnit(me.id, editionId);
  if (!result.ok) return { error: result.error };
  redirect("/checkout");
}

/** Extend and release act only on the signed-in account's own hold (holds.ts checks that). */
export async function extend(form: FormData) {
  const me = await currentAccount();
  const longer = me && UUID.test(field(form, "hold")) ? await extendHold(me.id, field(form, "hold")) : null;
  redirect(longer ? "/checkout?extended=1" : "/checkout");
}

export async function release(form: FormData) {
  const me = await currentAccount();
  if (me && UUID.test(field(form, "hold"))) await releaseHold(me.id, field(form, "hold"));
  redirect("/checkout?released=1");
}

export type AddressState = { error?: AddressProblem | "full" | "gone"; values?: Record<string, string> };

/**
 * Checkout sends no id and edits the default address (or adds the first). The address book sends the id it is
 * editing, or "new".
 */
export async function saveAddress(_state: AddressState, form: FormData): Promise<AddressState> {
  const me = await currentAccount();
  const book = field(form, "from") === "book";
  if (!me) redirect(`/login?next=${book ? "/account/addresses" : "/checkout"}`);
  const values = Object.fromEntries(["recipient", "receiverPhone", "province", "ward", "street"].map((name) => [name, field(form, name)])) as Record<"recipient" | "receiverPhone" | "province" | "ward" | "street", string>;
  const result = cleanAddress(values);
  if ("problem" in result) return { error: result.problem, values };
  const asked = field(form, "id");
  if (asked && asked !== "new" && !UUID.test(asked)) return { error: "gone", values };
  const id = asked === "new" ? undefined : asked || (await listAddresses(me.id)).find((row) => row.isDefault)?.id;
  const written = await writeAddress(me.id, result.value, id);
  if (written !== "ok") return { error: written, values };
  redirect(book ? "/account/addresses?done=saved" : "/checkout?saved=1");
}

/** From the address book, or from checkout's "use another saved address", and back to whichever it was. */
export async function setDefaultAddress(form: FormData) {
  const me = await currentAccount();
  const back = field(form, "from") === "checkout" ? "/checkout" : "/account/addresses";
  if (!me) redirect(`/login?next=${back}`);
  const id = field(form, "id");
  const done = UUID.test(id) && (await makeDefault(me.id, id));
  redirect(done ? `${back}?${back === "/checkout" ? "delivery=1" : "done=default"}` : back);
}

export async function deleteAddress(form: FormData) {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/addresses");
  const id = field(form, "id");
  const done = UUID.test(id) && (await removeAddress(me.id, id));
  redirect(done ? "/account/addresses?done=deleted" : "/account/addresses");
}
