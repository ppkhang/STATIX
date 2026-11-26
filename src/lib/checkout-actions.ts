"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentAccount } from "@/auth";
import { db } from "@/db";
import { address } from "@/db/schema";
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
  if (me && UUID.test(field(form, "hold"))) await extendHold(me.id, field(form, "hold"));
  redirect("/checkout");
}

export async function release(form: FormData) {
  const me = await currentAccount();
  if (me && UUID.test(field(form, "hold"))) await releaseHold(me.id, field(form, "hold"));
  redirect("/checkout?released=1");
}

export type AddressState = { error?: AddressProblem; saved?: boolean; values?: Record<string, string> };

/** shortcut: one delivery address per account, the default one. The address book is M5 (page 16). */
export async function saveAddress(_state: AddressState, form: FormData): Promise<AddressState> {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/checkout");
  const values = Object.fromEntries(["recipient", "receiverPhone", "province", "ward", "street"].map((name) => [name, field(form, name)])) as Record<"recipient" | "receiverPhone" | "province" | "ward" | "street", string>;
  const result = cleanAddress(values);
  if ("problem" in result) return { error: result.problem, values };
  await db.transaction(async (tx) => {
    const [mine] = await tx.select({ id: address.id }).from(address).where(and(eq(address.accountId, me.id), eq(address.isDefault, true)));
    if (mine) await tx.update(address).set(result.value).where(eq(address.id, mine.id));
    else await tx.insert(address).values({ ...result.value, accountId: me.id, isDefault: true });
  });
  redirect("/checkout?saved=1");
}
