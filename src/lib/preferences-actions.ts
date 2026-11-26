"use server";

import { redirect } from "next/navigation";
import { entryFromToken } from "./manage-token";
import * as waitlist from "./waitlist";

// Every action re-checks the signed token: the page it came from is not proof of anything.
const page = (token: string, query = "") => `/preferences/${encodeURIComponent(token)}${query}`;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

async function owner(form: FormData) {
  const token = field(form, "token");
  const entryId = entryFromToken(token);
  const email = entryId ? await waitlist.emailOf(entryId) : null;
  if (!email) redirect(page(token));
  return { token, email };
}

export async function leaveList(form: FormData) {
  const { token, email } = await owner(form);
  await waitlist.leave(email, field(form, "entry"));
  redirect(page(token, "?done=left"));
}

export async function setMarketing(form: FormData) {
  const { token, email } = await owner(form);
  await waitlist.setMarketing(email, field(form, "marketing") === "on");
  redirect(page(token, "?done=saved"));
}

export type DeleteState = { error?: "typeDelete" };

export async function deleteMyData(_state: DeleteState, form: FormData): Promise<DeleteState> {
  const { email } = await owner(form);
  if (field(form, "confirm").trim() !== "DELETE") return { error: "typeDelete" };
  await waitlist.erase(email);
  redirect("/preferences/deleted");
}
