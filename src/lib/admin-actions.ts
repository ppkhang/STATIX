"use server";

// Thin on purpose: who is asking, and what they typed. admin-drops.ts checks the role, the rules and writes the log.
import { redirect } from "next/navigation";
import { addEdition, createDrop, scheduleDrop, updateDrop, updateEdition, type DropProblem, type Result } from "./admin-drops";
import { fromVietnamInput } from "./drop-admin-rules";
import { requireStaff } from "./staff-session";

export type AdminState = { error?: DropProblem; values?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(form: FormData) {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  // digits only: Number() alone would take "1e3" and " "
  const whole = (name: string) => (/^\d{1,10}$/.test(text(name)) ? Number(text(name)) : Number.NaN);
  return {
    text, whole,
    drop: () => ({ name: text("name"), earlyAccessAt: fromVietnamInput(text("earlyAccessAt")), publicAt: fromVietnamInput(text("publicAt")), closeAt: fromVietnamInput(text("closeAt")) }),
    terms: () => ({ size: whole("size"), priceVnd: whole("priceVnd"), perPersonCap: whole("perPersonCap") }),
    values: () => Object.fromEntries([...form.entries()].filter(([name]) => !name.startsWith("$")).map(([name, value]) => [name, String(value)])),
  };
}

const done = (result: Result, input: ReturnType<typeof read>, to: string): AdminState => {
  if (!result.ok) return { error: result.error, values: input.values() };
  redirect(to);
};

const dropPage = (number: number) => `/admin/drops/${number}?saved=1`;

export async function createDropAction(_state: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireStaff("drops");
  const input = read(form);
  const number = input.whole("number");
  return done(await createDrop(me, number, input.drop()), input, dropPage(number));
}

export async function updateDropAction(_state: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireStaff("drops");
  const input = read(form);
  const number = input.whole("number");
  return done(await updateDrop(me, number || 0, input.drop()), input, dropPage(number));
}

export async function scheduleDropAction(_state: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireStaff("drops");
  const input = read(form);
  const number = input.whole("number");
  return done(await scheduleDrop(me, number || 0), input, dropPage(number));
}

export async function addEditionAction(_state: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireStaff("drops");
  const input = read(form);
  const number = input.whole("number");
  const variantId = input.text("variant");
  if (!UUID.test(variantId)) return { error: "gone", values: input.values() };
  return done(await addEdition(me, number || 0, variantId, input.terms()), input, dropPage(number));
}

export async function updateEditionAction(_state: AdminState, form: FormData): Promise<AdminState> {
  const me = await requireStaff("drops");
  const input = read(form);
  const editionId = input.text("edition");
  if (!UUID.test(editionId)) return { error: "gone", values: input.values() };
  return done(await updateEdition(me, editionId, input.terms()), input, dropPage(input.whole("number")));
}
