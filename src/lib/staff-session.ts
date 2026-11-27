// The staff cookie, and the gate every admin page and action goes through.
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { can, firstOwner, SESSION_HOURS, staffFor, type AdminPage, type Staff } from "./staff";

export const STAFF_COOKIE = "statix_staff";
export const staffCookie = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin",
  maxAge: SESSION_HOURS * 3600,
} as const;

// ADMIN_NO_LOGIN=1 in .env.local skips signing in under `next dev` only. A production build ignores it. You act as the
// first owner account, so the audit log still names someone. The address check stops another device browsing in; it
// can be faked, so `next dev -H 127.0.0.1` is what really keeps the network out.
const noLogin = process.env.NODE_ENV === "development" && process.env.ADMIN_NO_LOGIN === "1";
const typedLocally = async () => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test((await headers()).get("host") ?? "");

export const currentStaff = cache(async (): Promise<Staff | null> => {
  if (noLogin && (await typedLocally())) return firstOwner();
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
