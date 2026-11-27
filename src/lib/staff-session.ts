// The staff cookie, and the gate every admin page and action goes through.
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can, SESSION_HOURS, staffFor, type AdminPage, type Staff } from "./staff";

export const STAFF_COOKIE = "statix_staff";
export const staffCookie = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin",
  maxAge: SESSION_HOURS * 3600,
} as const;

export const currentStaff = cache(async (): Promise<Staff | null> => {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  return token ? staffFor(token) : null;
});

/** Signed out goes to staff sign-in. A role that may not open the page is told it isn't there. */
export async function requireStaff(page: AdminPage): Promise<Staff> {
  const me = await currentStaff();
  if (!me) redirect("/admin/login");
  if (!can(me.role, page)) notFound();
  return me;
}
