"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentAccount, signOut } from "@/auth";
import { deleteAccount, type DeleteBlock } from "./account-delete";
import { verifyPassword } from "./password";
import { allow, clientIp } from "./rate-limit";

export type DeleteAccountState = { error?: DeleteBlock | "typeDelete" | "badPassword" | "rateLimited" };

export async function deleteMyAccount(_state: DeleteAccountState, form: FormData): Promise<DeleteAccountState> {
  const me = await currentAccount();
  if (!me) redirect("/login?next=/account/delete");
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: "typeDelete" };
  // a session left open isn't enough to destroy the account. Google-only accounts have no password to ask for
  if (me.passwordHash) {
    if (!(await allow(`delete:${me.id}`, 10, 3600)) || !(await allow(`delete:ip:${clientIp(await headers())}`, 20, 3600))) return { error: "rateLimited" };
    if (!(await verifyPassword(String(form.get("password") ?? ""), me.passwordHash))) return { error: "badPassword" };
  }
  const result = await deleteAccount(me.id);
  if (result !== "deleted") return { error: result };
  await signOut({ redirectTo: "/account/deleted" });
  return {};
}
